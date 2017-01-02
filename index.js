var request = require('request');
var rp = require('request-promise');
var _ = require('lodash');
var winston = require('winston');

if (winston.level === 'debug') {
    require('request-debug')(rp, function(type, data, r) {
        debug('request', null, {type: type, data: data});
    });
}

const urls = {
    base: 'https://www.kroger.com',
    clicklist: '/storecatalog/clicklistbeta',
    authenticate: '/user/authenticate',
    favorites: '/storecatalog/clicklistbeta/api/items/personalized/myFavorites',
    recentPurchases: '/storecatalog/clicklistbeta/api/items/personalized/recentPurchases/quick',
    cart: '/storecatalog/clicklistbeta/api/cart',
    addToCart: '/storecatalog/clicklistbeta/api/cart/item',
    removeFromCart: '/storecatalog/clicklistbeta/api/cart/item?strategy=deleteItem'
};

var api = {
    login: login,
    logout: logout,
    favorites: favorites,
    recentPurchases: recentPurchases,
    cart: cart,
    addToCart: addToCart,
    removeFromCart: removeFromCart
};

module.exports = api;

function login(email, password) {
    debug('start', 'login', {email: email, password: password});
    var body = {
        account: {
            email: email,
            password: password,
            rememberMe: true
        },
        location: ''
    };

    api._jar = request.jar();

    return post(urls.authenticate, body)
        .then(createCookies)
        .then(setupOnlineShopping)
        .then(logEnd('login'))
        .catch(logAndThrow('login'));

    function createCookies(resp) {
        createStoreCookies(api._jar, resp.store.storeInformation);
        return resp;
    }

    function setupOnlineShopping(resp) {
        // Some crazy Kroger stuff - I wonder if we need to follow all of the redirects?
        var qs = { redirectUrl: 'https://www.kroger.com/storecatalog/servlet/OnlineShoppingStoreSetup' };
        return get('/redirect', qs).then(grabXsrfToken);
        
        function grabXsrfToken() {
            // Get the XSRF_TOKEN from cookies so it can be set in the header
            var xsrfTokenCookie = _.find(api._jar.getCookies('https://www.kroger.com/'), {key: 'XSRF-TOKEN'});
            if (xsrfTokenCookie) {
                api._xsrfToken = xsrfTokenCookie.value;
                info('Setting api._xsrfToken to XSRF-TOKEN cookie value', 'login', {token: api._xsrfToken});
            } else {
                error('XSRF-TOKEN cookie not found', 'login');
                throw Error('XSRF-TOKEN cookie not found!');
            }
            return resp;
        }
    }
}

function logout() {
    api._jar = null;
}

function favorites() {
    var method = 'favorites';
    debug('start', method);
    return get(urls.favorites)
        .then(logEnd(method))
        .catch(logAndThrow(method));
}

function recentPurchases() {
    var method = 'recentPurchases';
    debug('start', method);
    return get(urls.recentPurchases)
        .then(logEnd(method))
        .catch(logAndThrow(method));
}

function cart() {
    var method = 'cart';
    debug('start', method);
    return get(urls.cart)
        .then(logEnd(method))
        .catch(logAndThrow(method));
}

function addToCart(item, qty) {
    var method = 'addToCart';
    debug('start', method, {item: item, qty: qty});

    var newQtyInCart = 0;
    return get(urls.cart)
        .then(buildItem)
        .then(postDecoratedItem)
        .then(function() {
            return { item: item, quantity: newQtyInCart };
        })
        .then(logEnd(method))
        .catch(logAndThrow(method));

    function buildItem(cart) {
        var cartItem = _.find(cart.cartItems, {upc: item.upc}) || {quantity: 0};
        var price = parseFloat(item.currentPrice);
        var addedProps = {
            quantityInCart: parseInt(cartItem.quantity),
            show: true,
            productId: null,
            quantity: parseInt(qty),
            allowSubstitutes: true,
            unitPrice: price,
            totalPrice: price * parseInt(qty),
            priceIsYellowTag: item.currentPriceIsYellowTag
        };

        newQtyInCart = addedProps.quantityInCart + addedProps.quantity;

        api._jar.setCookie('orderId=' + cart.orderId, urls.base + urls.clicklist);
        
        return _.assignIn(_.cloneDeep(item), addedProps);
    }

    function postDecoratedItem(decoratedItem) {
        return post(urls.addToCart, decoratedItem);
    }
}

function removeFromCart(itemUpc) {
    var method = 'removeFromCart';
    debug('start', method, {itemUpc: itemUpc});

    return get(urls.cart)
        .then(findItemInCart)
        .then(postRemoveItem)
        .then(logEnd(method))
        .catch(logAndThrow(method));
    
    function findItemInCart(cart) {
        return _.find(cart.cartItems, {upc: itemUpc});
    }

    function postRemoveItem(item) {
        if (item) {
            return post(urls.addToCart, decoratedItem);
        }
        return Promise.resolve();
    }
}

// ----- Internals
function get(uri, qs) {
    return makeRequest(uri, 'GET', qs);
}

function post(uri, body) {
    return makeRequest(uri, 'POST', null, body);
}

function makeRequest(uri, method, qs, body) {
    debug('start', 'makeRequest', {uri: uri, method: method, qs: qs, body: body});

    var options = {
        uri: uri,
        baseUrl: urls.base,
        method: method,
        jar: api._jar,
        json: true,
        maxRedirects: 20
    };
    var headers = {};
    if (qs) options.qs = qs;
    if (body) options.body = body;
    if (api._xsrfToken) headers['x-xsrf-token'] = api._xsrfToken;

    options.headers = headers;

    debug('options', 'makeRequest', {options: options});

    return rp(options);
}

function createStoreCookies(jar, store) {
    debug('start', 'createStoreCookies', {jar: jar, store: store});

    var uri = 'http://www.kroger.com';

    // From authenticate
    jar.setCookie('StoreCode=' + store.storeNumber, uri);
    jar.setCookie('StoreLocalName=' + store.localName, uri);
    jar.setCookie('StoreAddress=' + addressify(store.address), uri);
    jar.setCookie('StoreZipCode=' + store.address.zipCode, uri);
    jar.setCookie('StoreInformation=' + info(store), uri);

    // After picking store
    jar.setCookie('eCommPickupStore=' + store.storeNumber, uri);
    jar.setCookie('eCommPickupStoreDivision=' + store.divisionNumber, uri);
    jar.setCookie('eCommPickupStoreChange=' + store.recordId, uri);
    jar.setCookie('eCommPickupStoreStreetAddress=' + store.address.addressLineOne, uri);
    jar.setCookie('eCommPickupStoreCity=' + store.address.city, uri);
    jar.setCookie('eCommPickupStoreState=' + store.address.state, uri);
    jar.setCookie('eCommPickupStoreZipCode=' + store.address.zipCode, uri);

    function addressify(address) {
        return address.addressLineOne + ', ' + address.city + ', ' + address.city;
    }

    function info(store) {
        return addressify(store.address) + ',' + store.phoneNumber + ',';
    }

    debug('end', 'createStoreCookies', {jar: jar, store: store});
}

function loggingMetadata(method, data) {
    return {
        module: 'clicklist-client',
        filename: 'index.js',
        method: method,
        ts: new Date(),
        data: data
    };
}

function debug(msg, method, data) {
    winston.debug(msg, loggingMetadata(method, data));
}

function info(msg, method, data) {
    winston.info(msg, loggingMetadata(method, data));
}

function error(msg, method, data) {
    winston.error(msg, loggingMetadata(method, data));
}

function logEnd(method) {
    return function(resp) {
        debug('end', method);
        return resp;
    }
}

function logAndThrow(method) {
    return function(err) {
        error(err, method, {err: err});
        throw err;
    }
}
