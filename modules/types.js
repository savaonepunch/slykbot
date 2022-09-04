// response of a call to the reddit module
module.exports.RedditObj = function redditObj(title = '', content = '', type = '') {
	this.title = title;
	this.content = content;
	this.type = type;
};

// reddit views 
module.exports.REDDIT_PAGE = Object.freeze({
	HOT: Symbol('HOT'),
	NEW: Symbol('NEW'),
	TOP: Symbol('TOP'),
	RISING: Symbol('RISING'),
	CONTROVERSAL: Symbol('CONTROVERSAL'),
});

// types of reddit responses
module.exports.REDDIT_TYPE = Object.freeze({
	TEXT: Symbol('TEXT'),
	IMAGE: Symbol('IMAGE'),
	VIDEO: Symbol('VIDEO'),
	WEBSITE: Symbol('WEBSITE'),
	ERROR: Symbol('ERROR') // response from the module of error occurs
});