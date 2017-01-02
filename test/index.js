require('dotenv').config();

var winston = require('winston');
winston.level = 'debug';

var should = require('chai').should(),
    clicklist = require('../index'),
    auth = {email: process.env.USER_NAME, pwd: process.env.PASSWORD };

describe('#login', function() {
    this.timeout(5000);
    it('is successful with correct credentials', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(resp => {
                resp.userProfile.emailAddress.should.equal(auth.email);
                resp.hasErrors.should.equal(false);
                clicklist.logout();
                done();
            })
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
                clicklist.logout();
                done();
            })
            .catch(err => done(err));
    });
});

describe('#recent purchases', function() {
    this.timeout(5000);
    it('lists the recent purchases', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(resp => clicklist.recentPurchases())
            .then(recent => {
                clicklist.logout();
                done();
            })
            .catch(err =>done(err));
    });
});

describe('#cart', function() {
    this.timeout(5000);
    it('listing the cart', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(resp => clicklist.cart())
            .then(cart => {
                clicklist.logout();
                done();
            })
            .catch(err =>done(err));
    });

    it('adding to the cart', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(() => clicklist.favorites())
            .then((favorites) => {
                return favorites[0];
            })
            .then((item) => {
                return clicklist.addToCart(item, 1)
            })
            .then(resp => {
                clicklist.logout();
                done();
            })
            .catch(err => done(err));
    });
});