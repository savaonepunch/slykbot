'use strict';

require('dotenv').config();
const snoowrap = require('snoowrap');
const ffmpeg = require('fluent-ffmpeg');
const https = require('https');
const fs = require('fs');
const ufs = require('url-file-size');
const catbox = require('catbox.moe');
const { RedditObj, REDDIT_PAGE, REDDIT_TYPE } = require('./types');
const config = require('./config.json').reddit;


// temp file hosting api
const litterbox = new catbox.Litterbox();

// reddit object
const reddit = new snoowrap({
	userAgent: config.userAgent,
	clientId: process.env.REDDIT_CLIENT_ID,
	clientSecret: process.env.REDDIT_CLIENT_SECRET,
	refreshToken: process.env.REDDIT_REFRESH_TOKEN,
});

function fetchOneRandomFrom(subreddit, page = REDDIT_PAGE.NEW) {
	return new Promise((resolve, reject) => {
		const submissionsPromise = getSubmissions(subreddit, page);

		if (submissionsPromise) {
			submissionsPromise.length.then((length) => {
				if (length > 0) {
					const randomIdx = Number.parseInt(Math.random() * length);
					submissionsPromise[randomIdx].then((randomSubmission) => {
						resolve(processSubmission(randomSubmission));
					});
				} else {
					reject('can`t find posts on r/' + subreddit + ', maybe it doesn`t exist?');
				}
			});
		} else {
			reject('invalid reddit view: ' + page);
		}
	});
}

// get posts of a reddit page
function getSubmissions(subreddit, page) {
	const sub = reddit.getSubreddit(subreddit);

	switch (page) {
	case REDDIT_PAGE.HOT:
		return sub.getHot();
	case REDDIT_PAGE.NEW:
		return sub.getNew();
	case REDDIT_PAGE.TOP:
		return sub.getTop();
	case REDDIT_PAGE.RISING:
		return sub.getRising();
	case REDDIT_PAGE.CONTROVERSAL:
		return sub.getControversial();
	default:
		return null;
	}
}

function processSubmission(s) {
	return new Promise((resolve) => {
		// check if crosspost: yes => get original post url
		if (s.crosspost_parent_list) {
			s = s.crosspost_parent_list[0];
		}

		// get .mp4 videos
		if (s.media && s.media.reddit_video) {
			resolve(getVideo(s.media.reddit_video.fallback_url, s.title, s.media.reddit_video.is_gif));
		} else {
			// get images
			if (s.url.includes('.png') || s.url.includes('.jpg') || s.url.includes('.gif')) {
				resolve(getImage(s.url, s.title.replaceAll('/', '|')));
			} else {
				// get text posts
				if (s.url.includes('/comments/')) {
					resolve(getTextPost(s));
				} else {
					// get link from external sites
					resolve(handleExternalSite(s));
				}
			}
		}
	});
}

// option 1: post is image
function getImage(url, title) {
	return new Promise((resolve, reject) => {
		ufs(url).then((size) => {
			// check if file is below upload limit before fetching
			if (size < config.uploadLimit) {
				let ext = '.png';
				if (url.includes('.gif')) {
					ext = '.gif';	
				}

				const file = fs.createWriteStream(config.folderpath + title + ext);

				file
					.on('error', (e) => {
						reject(e);
					})
					.on('finish', () => {
						file.close();
						resolve(new RedditObj(title, file.path, REDDIT_TYPE.IMAGE));
					});

				https.get(url, (response) => {
					response.pipe(file);
				}).on('error', e => {
					reject(e);
				});
			}
		}).catch((e) => {
			reject(e + ' from Image');
		});
	});
}

// option 2: post is video
function getVideo(url, title, is_gif, retry = false) {
	return new Promise((resolve, reject) => {
		ufs(url).then((size) => {
			// check if file is below upload limit before fetching
			if (size < config.uploadLimit) {
				// spawn a new ffmpeg process for each video
				const proc = new ffmpeg();

				proc.on('error', (e) => {
					if (retry) {
						// if retry failed => fail ... lol
						reject(e);
					} else {
						// retry video without audio => maybe .mp4 has no audio
						getVideo(url, title, true, true);
					}
				});

				// add muted video
				proc.addInput(url).withInputOption(['-threads 1']);
				// add audio if no gif
				if (!is_gif) {
					proc.addInput(url.substring(0, url.lastIndexOf('/') + 1) + 'DASH_audio.mp4').withInputOption(['-threads 1']);
				}

				const filepath = config.folderpath + title.replaceAll('/', '|') + '.mp4';
				proc.saveToFile(filepath);

				proc.on('end', () => {
					resolve(new RedditObj(title, filepath, REDDIT_TYPE.VIDEO));
				});
			}
		}).catch((e) => {
			reject(e + ' from Video');
		});
	});
}

// option 3: its a link to another website
function handleExternalSite(submission) {
	return new Promise((resolve) => {
		resolve(new RedditObj(submission.title, submission.url, REDDIT_TYPE.WEBSITE));
	});
}

// option 4: its a text post
function getTextPost(submission) {
	return new Promise((resolve) => {
		resolve(new RedditObj(submission.title, submission.selftext, REDDIT_TYPE.TEXT));
	});
}

// upload file to file host and return the url
function upload(redditObj) {
	let filepath = redditObj.content;
	return new Promise((resolve, reject) => {
		// if its a vid or pic => upload to litterbox and return the url
		litterbox.upload(filepath).then((url) => {
			// after upload delete local file
			fs.unlink(filepath, () => {
				resolve(new RedditObj(redditObj.title, url, redditObj.type));
			});
		}).catch((e) => {
			// if error from file host => delete orphaned file
			fs.unlink(filepath, () => {
				reject(e);
			});
		});
	});
}

// checks if it can send result directly or needs to upload first
function prepareResult(redditObj) {
	if (redditObj.content.startsWith(config.folderpath)) {
		// if is downloaded file => upload
		return upload(redditObj);
	} else {
		// regular string => external link or text post
		return redditObj;
	}
}

module.exports.getPostFromSubreddit = function (subreddit, page = REDDIT_PAGE.HOT) {
	return new Promise( (resolve, reject) => {
		fetchOneRandomFrom(subreddit, page)
			.then(prepareResult)
			.then( redditObj => {
				resolve(redditObj);
			})
			.catch( e => {
				reject(new RedditObj('uh oh ... something failed', e, REDDIT_TYPE.ERROR));
			});
	});
};