require('dotenv').config();

var should = require('chai').should(),
    clicklist = require('../index'),
    auth = {email: process.env.USER_NAME, pwd: process.env.PASSWORD };

//require('request-debug')(require('request-promise'));

describe('#login', function() {
    this.timeout(5000);
    it('is successful with correct credentials', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(resp => {
                resp.userProfile.emailAddress.should.equal(auth.email);
                resp.hasErrors.should.equal(false);
                done();
            })
            .then(() => clicklist.logout())
            .catch(err => done(err));
    });

    it('fails with incorrect credentials', done => {
        done();
    });
});

describe('#favorites', function() {
    this.timeout(5000);
    it('lists the favorites', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(resp => clicklist.favorites())
            .then(favorites => {
                //console.log(favorites);
                done();
            })
            .then(() => clicklist.logout())
            .catch(err => done(err));
    });
});

describe('#recent purchases', function() {
    this.timeout(5000);
    it('lists the recent purchases', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(resp => clicklist.recentPurchases())
            .then(recent => {
                //console.log(recent);
                done();
            })
            .then(() => clicklist.logout())
            .catch(err =>done(err));
    });
});

describe('#cart', function() {
    this.timeout(5000);
    xit('listing the cart', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(resp => clicklist.cart())
            .then(cart => {
                //console.log(cart);
                done();
            })
            .then(() => clicklist.logout())
            .catch(err =>done(err));
    });

    it('adding to the cart', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(() => clicklist.favorites())
            .then((favorites) => {
                return favorites[0];
            })
            .then((item) => {
                console.log('Adding item: ' + JSON.stringify(item));
                return clicklist.addToCart(item, 1)
            })
            .then(resp => clicklist.cart())
            .then(cart => {
                console.log(cart);
                done();
            })
            .then(() => clicklist.logout())
            .catch(err =>done(err));
    });
});