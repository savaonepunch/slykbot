'use strict';
const snoowrap = require('snoowrap');
const ffmpeg = require('fluent-ffmpeg');
const https = require('https');
const fs = require('fs');
const ufs = require('url-file-size');
const config = require('./config.json').reddit;

const treshold = 8000000; // discord upload limit in bytes

const reddit = new snoowrap({
    userAgent: config.userAgent,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: config.refreshToken
});

function fetchOneRandomFrom(subreddit, page = 'NEW') {
    const submissionsPromise = getSubmissions(subreddit, page);

    if (submissionsPromise) {
        submissionsPromise.length.then(length => {
            if (length > 0) {
                const randomIdx = Number.parseInt(Math.random() * length);
                submissionsPromise[randomIdx].then(randomSubmission => {
                    processSubmission(randomSubmission);
                });
            } else {
                console.error('invalid or empty subreddit: ' + subreddit);
            }
        });
    } else {
        console.error('invalid page: ' + page);
    }
}

function fetchFrom(subreddit, page = 'HOT') {
    const submissionsPromise = getSubmissions(subreddit, page);

    if (submissionsPromise) {
        submissionsPromise.then(submissions => {
            if (submissions.length > 0) {
                submissions.forEach(submission => {
                    submission.fetch().then(s => {
                        processSubmission(s);
                    });
                });
            } else {
                console.error('invalid or empty subreddit: ' + subreddit);
            }
        });
    } else {
        console.error('invalid page: ' + page);
    }
}

function getSubmissions(subreddit, page = 'HOT') {
    const sub = reddit.getSubreddit(subreddit);
    let submissionsPromise;
    page = page.toLocaleUpperCase();

    switch (page) {
        case 'HOT':
            submissionsPromise = sub.getHot();
            break;
        case 'NEW':
            submissionsPromise = sub.getNew();
            break;
        case 'TOP':
            submissionsPromise = sub.getTop();
            break;
        case 'RISING':
            submissionsPromise = sub.getRising();
            break;
        case 'CONTROVERSAL':
            submissionsPromise = sub.getControversial();
            break;
        default:
            submissionsPromise = null;
            break;
    }
    return submissionsPromise;
}

function processSubmission(s) {
    if (s.media && s.media.reddit_video) {
        // get .mp4 videos
        getVideo(s.media.reddit_video.fallback_url, s.title, s.media.reddit_video.is_gif);
    } else {
        // get images
        if (s.url.includes('.png') || s.url.includes('.jpg') || s.url.includes('.gif')) {
            getImage(s.url, s.title.replaceAll('/', '|'));
        } else {
            // handle text posts
            if (s.url.includes(`/comments/`)) {
                handleTextPost(s);
            } else {
                // get media from external sites
                handleExternalSite(s)
            }
        }
    }
}

function getImage(url, title) {
    ufs(url).then(size => {
        // check if file is below upload limit before fetching
        if (size < treshold) {
            let file;
            if (!url.includes('.gif')) {
                file = fs.createWriteStream(config.folderpath + title + '.png');
            } else {
                file = fs.createWriteStream(config.folderpath + title + '.gif');
            }

            file
                .on('error', console.error)
                .on('finish', () => {
                    file.close();
                });

            https.get(url, response => {
                response.pipe(file);
            });

        }
    }).catch(e => {
        console.log(url);
        console.error(e + ' from Image')
    })

}

function getVideo(url, title, is_gif) {
    ufs(url).then(size => {
        // check if file is below upload limit before fetching
        if (size < treshold) {
            // spawn a new ffmpeg process for each video
            const proc = new ffmpeg();
            proc.on('error', console.error);

            // add muted video
            proc.addInput(url);

            // add audio if no gif
            if (!is_gif) {
                proc.addInput(url.substring(0, url.lastIndexOf('/') + 1) + 'DASH_audio.mp4');
            }

            proc.saveToFile(config.folderpath + title + '.mp4');
        }
    }).catch(e => {
        console.log(url);
        console.error(e + ' from Video')
    })
}

function handleExternalSite(submission) {
    // TODO: handle external sites
    console.log('found external site: ' + submission.url)
}

function handleTextPost(submission) {
    // TODO: handle text posts
    console.log(submission.selftext);
    console.log('text post');
}