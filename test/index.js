var should = require('chai').should(),
    clicklist = require('../index'),
    auth = {email: 'hogan.cs@gmail.com', pwd: 'M1ssinglois' };

require('request-debug')(require('request-promise'));

xdescribe('#login', () => {
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

describe('#favorites', () => {
    it('lists the favorites', done => {
        clicklist.login(auth.email, auth.pwd)
            .then(resp => clicklist.favorites())
            .then(favorites => {
                console.log(favorites);
                done();
            })
            .then(() => clicklist.logout())
            .catch(err =>done(err));
    });
});