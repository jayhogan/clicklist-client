var request = require('request');
var rp = require('request-promise');
var _ = require('lodash');

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
        .then(setupOnlineShopping);

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
                console.log('XSRF-TOKEN cookie: ' + api._xsrfToken);
            } else {
                throw Error('XSRF-TOKEN cookie not found!')
            }
            return resp;
        }
    }
}

function logout() {
    api._jar = null;
}

function favorites() {
    return get(urls.favorites);
}

function recentPurchases() {
    return get(urls.recentPurchases);
}

function cart() {
    return get(urls.cart);
}

function addToCart(item, qty) {
    var newQtyInCart = 0;
    return get(urls.cart)
        .then(buildItem)
        .then(postDecoratedItem)
        .then(function() {
            return { item: item, quantity: newQtyInCart };
        });

    function buildItem(cart) {
        var cartItem = _.find(cart.cartItems, {upc: item.upc}) || {quantity: 0};
        var price = parseFloat(item.currentPrice);
        var addedProps = {
            quantityInCart: cartItem.quantity,
            show: true,
            productId: null,
            quantity: qty,
            allowSubstitutes: true,
            unitPrice: price,
            totalPrice: price * qty,
            priceIsYellowTag: item.currentPriceIsYellowTag
        };

        newQtyInCart = cartItem.quantity + qty;

        api._jar.setCookie('orderId=' + cart.orderId, urls.base + urls.clicklist);
        
        return _.assignIn(_.cloneDeep(item), addedProps);
    }

    function postDecoratedItem(decoratedItem) {
        return post(urls.addToCart, decoratedItem);
    }
}

function removeFromCart(itemUpc) {
    return get(urls.cart)
        .then(findItemInCart)
        .then(postRemoveItem);
    
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
    return rp(options);
}

function createStoreCookies(jar, store) {
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
}
