'use strict';
// response of a call to the reddit module
module.exports.RedditObj = function redditObj(title = '', content = '', type = '', postUrl = '') {
	this.title = title;
	this.content = content;
	this.type = type;
	this.postUrl = postUrl;
};

// types of reddit responses
module.exports.REDDIT_TYPE = Object.freeze({
	TEXT: Symbol('TEXT'),
	IMAGE: Symbol('IMAGE'),
	VIDEO: Symbol('VIDEO'),
	WEBSITE: Symbol('WEBSITE'),
	ERROR: Symbol('ERROR'),
});
