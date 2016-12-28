var request = require('request');
var rp = require('request-promise');
var _ = require('lodash');

const urls = {
    base: 'https://www.kroger.com',
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
    // api._jar = request.jar();
    return post(urls.authenticate, body);
}

function logout() {
    // api._jar = null;
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
    return get(urls.cart)
        .then(buildItem)
        .then(postDecoratedItem);

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

// ----- Private
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
        jar: true,
        json: true,
        followRedirect: false
    };
    if (qs) options.qs = qs;
    if (body) options.body = body;
    return rp(options);
}
