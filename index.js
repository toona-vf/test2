const express = require('express');
const webtorrent = require('webtorrent');
const bodyParser = require('body-parser');
const parseTorrent = require('parse-torrent');
const multipart = require('connect-multiparty');
const path = require('path');
const http = require('http');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const jwt = require('jsonwebtoken') 
const randtoken = require('rand-token') 
const { getVideoDurationInSeconds } = require('get-video-duration')
const app = express();
const host = '0.0.0.0';
const port = process.env.PORT || 3000;
const segmentDur = 5; //  Controls the duration (in seconds) that the file will be chopped into.
        
var client = new webtorrent();
function clientErrorHandler (err, req, res, next) {
	if (req.xhr) {
	   res.status(500).send({ error: 'Something failed!' })
	 } else {
	   next(err)
	}
 }
 
 app.use(clientErrorHandler);
// Allow Cross-Origin requests
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'OPTIONS, POST, GET, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

var getLargestFile = function (torrent) {
    var file;
    for(i = 0; i < torrent.files.length; i++) {
        if (!file || file.length < torrent.files[i].length) {
            file = torrent.files[i];
        }
    }
    return file;
};

var getVideoParams = function (quality) {
	var params;
	for(i = 0; i < videoPresets.length; i++) {
        if (videoPresets[i].quality == quality) {
            params = videoPresets[i];
        }
    }
    return params;
};

var buildMagnetURI = function(infoHash) {
    return 'magnet:?xt=urn:btih:' + infoHash + '&tr=udp%3A%2F%2Ftracker.publicbt.com%3A80&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=udp%3A%2F%2Ftracker.ccc.de%3A80&tr=udp%3A%2F%2Ftracker.istole.it%3A80&tr=udp%3A%2F%2Fopen.demonii.com%3A1337&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Fexodus.desync.com%3A6969';
};

var myParseTorrent = function(uri, callback) {
	if(typeof uri == 'string' && (uri.substring(0, 7) == 'http://' || uri.substring(0, 8) == 'https://')) {
		parseTorrent.remote(uri, function(err, data) {
			if(err) { callback(false); }
			callback(data.infoHash.toLowerCase());
		});
	} else {
		var parsed = parseTorrent(uri);
		callback(parsed.infoHash.toLowerCase());
	}
};

var removeTorrent = function(ih) {
	var m = buildMagnetURI(ih);
	client.remove(m);
	delete store.uris[ih];
	delete store.torrents[ih];
	delete store.lastAccess[ih];
};

var time = function() {
	return Math.floor(new Date() / 1000);
};

var videoPresets = [
	{
		quality: '720p', 
		video: {
			codec: 'libvpx',
			bitrate: '4096k'
		},
		audio: {
			codec: 'libvorbis',
			bitrate: '256k'
		},
		picture: {
			resolution: '1280x?'
		}
	},
	{
		quality: '480p', 
		video: {
			codec: 'libvpx',
			bitrate: '3072k'
		},
		audio: {
			codec: 'libvorbis',
			bitrate: '192k'
		},
		picture: {
			resolution: '854x?'
		}
	},
	{
		quality: '360p', 
		video: {
			codec: 'libvpx',
			bitrate: '2048k'
		},
		audio: {
			codec: 'libvorbis',
			bitrate: '128k'
		},
		picture: {
			resolution: '640x?'
		}
	},
	{
		quality: '240p', 
		video: {
			codec: 'libvpx',
			bitrate: '1024k'
		},
		audio: {
			codec: 'libvorbis',
			bitrate: '96k'
		},
		picture: {
			resolution: '426x?'
		}
	},
	{
		quality: '144p', 
		video: {
			codec: 'libvpx',
			bitrate: '512k'
		},
		audio: {
			codec: 'libvorbis',
			bitrate: '64k'
		},
		picture: {
			resolution: '256x?'
		}
	}
];

var store = {};
store.uris = {};
store.lastAccess = {};
store.torrents = {};

setInterval(function() {
	var _time = time();
	Object.keys(store.lastAccess).forEach(function(key) {
		var accessTime = store.lastAccess[key];
		var delay = 60 * 30;
		if(_time - accessTime > delay) {
			console.log('Autoremoving ' + key + ' after ' + delay + ' seconds!');
			removeTorrent(key);
		}
	});
}, 1000);

app.post('/api/parse-torrent', function(req, res) {
	if(typeof req.body.uri == 'undefined' || req.body.uri == '') {
        res.status(500).json('Missing URI parameter!'); return;
    }
    myParseTorrent(req.body.uri, function(infoHash) {
		if(!infoHash) {
			return res.status(500).send('Error. ');
		}
        res.status(200).json({ infoHash: infoHash });
        
	});
});

app.get('/api/video-presets', function(req, res) {
	var presets = [];
	videoPresets.forEach(function(preset) {
		presets.push(preset.quality);
	});
	res.status(200).send(presets);
});


app.post('/api/upload-torrent', multipart(), function (req, res) {
	var file = req.files && req.files.file;
	if(!file) {
		res.status(500).json('Missing file parameter!'); return;
	}
	myParseTorrent(fs.readFileSync(file.path), function(infoHash) {
		if(!infoHash) {
			return res.status(500).send('Error. ');
		}
        res.status(200).json({ infoHash: infoHash });
      
	});
});

app.post('/api/add-torrent', function(req, res) {
    if(typeof req.body.infoHash == 'undefined' || req.body.infoHash == '') {
        res.status(500).json('Missing infoHash parameter!'); return;
    }
    var infoHash = req.body.infoHash;
    var uri = buildMagnetURI(infoHash);
    if(typeof store.torrents[infoHash] != 'undefined') {
		res.status(200).json('Added torrent!');
		store.lastAccess[infoHash] = time();
		return;
	}
    try {
        store.torrents[infoHash] = client.add(uri, function (torrent) {
			store.uris[infoHash] = uri;
			store.lastAccess[infoHash] = time();
            res.status(200).json('Added torrent!');
        });
    } catch (err) {
        res.status(500).json('Error: ' + err.toString());
    }
});
app.get('/api/torrent/:infoHash/download/:index', function(req, res) {
    if(typeof req.params.infoHash == 'undefined' || req.params.infoHash == '') {
        res.status(500).json('Missing infoHash parameter!'); return;
    }
    var infoHash = req.params.infoHash;
    var index = req.params.index;
    var uri = buildMagnetURI(infoHash);
    if(typeof store.torrents[infoHash] == 'undefined') {
		res.status(404).json('Torrent not found!');
		return;
	}
    try {
        var torrent = client.get(uri);
        if(typeof torrent.files[index] == 'undefined') {
			res.status(404).json('File not found!');
			return;
		}
        var file = torrent.files[index];
        var total = file.length;

        if(typeof req.headers.range != 'undefined') {
            var range = req.headers.range;
            var parts = range.replace(/bytes=/, "").split("-");
            var partialstart = parts[0];
            var partialend = parts[1];
            var start = parseInt(partialstart, 10);
            var end = partialend ? parseInt(partialend, 10) : total - 1;
            var chunksize = (end - start) + 1;
        } else {
            var start = 0; var end = total; var chunksize = total;
        }

        var stream = file.createReadStream({start: start, end: end});
        res.writeHead(206, { 
			'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 
			'Accept-Ranges': 'bytes', 
			'Content-Length': chunksize, 
			'Content-Disposition': 'attachment; filename="' + file.name + '"', 
			'Content-Type': 'application/octet-stream' 
		});
        stream.pipe(res);
    } catch (err) {
        res.status(500).send('Error: ' + err.toString());
    }
});
app.get('/api/torrent/:infoHash/files', function(req, res) {
    if(typeof req.params.infoHash == 'undefined' || req.params.infoHash == '') {
        res.status(500).send('Missing infoHash parameter!'); return;
    }
    var infoHash = req.params.infoHash;
    var uri = buildMagnetURI(infoHash);
    if(typeof store.torrents[infoHash] == 'undefined') {
		res.status(404).send('Torrent not found!');
		return;
	}
    try {
        var torrent = client.get(uri);
        
        var files = [];
        
        for(i = 0; i < torrent.files.length; i++) {
			var file = torrent.files[i];
			files.push({
				index: i,
				name: file.name,
				size: file.length
			});
		}
        
        res.status(200).send({ title: torrent.name, files: files });
    } catch (err) {
        res.status(500).send('Error: ' + err.toString());
    }
});

app.get('/api/torrent/:infoHash/m3u8/:index', async(req, res) => {
    if(typeof req.params.infoHash == 'undefined' || req.params.infoHash == '') {
        res.status(500).send('Missing infoHash parameter!'); return;
    }
    var infoHash = req.params.infoHash;
    var index = req.params.index;
    var uri = buildMagnetURI(infoHash);
    if(typeof store.torrents[infoHash] == 'undefined') {
		res.status(404).send('Torrent not found!');
		return;
	}
    try {
        var torrent = client.get(uri);
        if(typeof torrent.files[index] == 'undefined') {
			res.status(404).send('File not found!');
			return;
		}
		var file = torrent.files[index];
        var total = file.length;
		var name = file.name.endsWith('.srt');


      
		res.set({"Content-Disposition":"attachment; filename=\"m3u8.m3u8\""});
		res.send(`#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=150000
	/api/torrent/${infoHash}/stream/${index}/m3u8?num=1
	#EXT-X-STREAM-INF:BANDWIDTH=240000
	/api/torrent/${infoHash}/stream/${index}/m3u8?num=2`)

	
	
    } catch (err) {
        res.status(500).send('Error: ' + err.toString());
    }
});
app.get('/api/torrent/:infoHash/stream/:index/m3u8', async(req, res) => {
	       
	
	var infoHash = req.params.infoHash;
    var index = req.params.index;
    var quality = req.params.quality;
	var uri = buildMagnetURI(infoHash);
	var torrent =  client.get(uri)
	var file = getLargestFile(torrent)
	let met = await getVideoDurationInSeconds(file.createReadStream(file));
    
  
  let out = '#EXTM3U\n' +
	  '#EXT-X-VERSION:3\n' +
	  `#EXT-X-TARGETDURATION:${segmentDur}\n` +
	  '#EXT-X-MEDIA-SEQUENCE:0\n' +
	  '#EXT-X-PLAYLIST-TYPE:VOD\n';

  let splits = Math.round(met /segmentDur);
  console.log(splits )
	  for(let i=0; i< splits; i++){
	  out += `#EXTINF:${segmentDur},\n/api/torrent/${infoHash}/stream/${index}/${i}.ts\n`;
  }
  out+='#EXT-X-ENDLIST\n';

  res.set({"Content-Disposition":"attachment; filename=\"m3u8.m3u8\""});
  res.send(out);

});
app.get('/api/torrent/:infoHash/stream/:index/metadata.json', function(req, res) {
	if(typeof req.params.infoHash == 'undefined' || req.params.infoHash == '') {
        res.status(500).send('Missing infoHash parameter!'); return;
    }
    var infoHash = req.params.infoHash;
    var index = req.params.index;
    var quality = req.params.quality;
	var uri = buildMagnetURI(infoHash);
	var torrent =  client.get(uri)
	var file = getLargestFile(torrent)

	
	
    if(typeof store.torrents[infoHash] == 'undefined') {
		res.status(404).send('Torrent not found!');
		return;
	}
	try {
        var torrent = client.get(uri);
        if(typeof torrent.files[index] == 'undefined') {
			res.status(404).send('File not found!');
			return;
		}
	
    } catch (err) {
        res.status(500).send('Error: ' + err.toString());
    }
});

app.get('/api/torrent/:infoHash/stream/:index/:seg.ts?', async(req, res) => {
    if(typeof req.params.infoHash == 'undefined' || req.params.infoHash == '') {
        res.status(500).send('Missing infoHash parameter!'); return;
    }
    var infoHash = req.params.infoHash;
    var index = req.params.index;
    var quality = req.params.quality;
    var uri = buildMagnetURI(infoHash);


	var start = false;
	if(typeof req.query.start != 'undefined' && req.query.start != null) {
		start = parseFloat(req.query.start);
	}
	var torrent =  client.get(uri)
	var file = getLargestFile(torrent)
	var total = file.length
	var segment = req.params.seg;
	var times = segment * segmentDur;
		res.contentType('mpegts');
		var command = ffmpeg({source:file.createReadStream(file)})
		
		.duration(segmentDur)
		.outputOptions('-preset veryfast')
		.outputOptions('-g 50')
		.outputOptions('-profile:v main')
		.withAudioCodec('aac')
		.outputOptions('-ar 48000')
		.withAudioBitrate('155k')
		.withVideoBitrate('1000k')
		.outputOptions('-c:v h264')
		.audioChannels(2)
		.outputOptions(`-output_ts_offset ${times}`)
		.format('mpegts')
		.on('end', function() {
			console.log('file has been converted succesfully');
		})
		.outputOptions([
			'-deadline realtime',
			'-error-resilient 1'
		])
		.on('error', function(err) {
			console.log('an error happened: ' + err.message);
		});
		if(times) {
			command.seekInput(times);
		}
		command.pipe(res, { end: true });
    
});

app.post('/api/torrent/:infoHash/delete', function(req, res) {
    if(typeof req.params.infoHash == 'undefined' || req.params.infoHash == '') {
        res.status(500).send('Missing infoHash parameter!'); return;
    }
    var infoHash = req.params.infoHash;
    if(typeof store.torrents[infoHash] == 'undefined') {
		res.status(404).send('Torrent not found!');
		return;
	}
    try {
        removeTorrent(infoHash);
        res.status(200).send('Removed torrent. ');
    } catch (err) {
        res.status(500).send('Error: ' + err.toString());
    }
});

var server = http.createServer(app);
server.listen(port, host, function() {
    console.log('Listening on' + host + port);
});
