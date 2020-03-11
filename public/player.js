$(function() {
	var params = window.location.hash.replace('#', '').split(';');
	//player.html#HASH;0;360p;640x360
	var infoHash = params[0];
	var fileID = params[1];
	var quality = params[2];
	var size = params[3];
	if(infoHash.length < 40) {
		console.error('[ERROR] Missing infoHash parameter!');
		console.log('Exiting...');
		return;
	}
	if(fileID == '') {
		console.warn('[WARNING] Missing fileID parameter, using "0" as the default. ');
		fileID = '0';
	}
	if(quality == '') {
		console.warn('[WARNING] Missing quality parameter, using "360p" as the default. ');
		quality = '360p';
	}
	if(size == '') {
		console.warn('[WARNING] Missing size parameter, using "640x360" as the default. ');
		var size = '640x360';
	}
	var width = size.split('x')[0];
	var height = size.split('x')[1];
	$('#video').attr('width', width);
	$('#video').attr('height', height);
	$('body').css({
		width: width,
		height: height
	});

		var video = videojs('video');
		
		
		video.src('/api/torrent/' + infoHash + '/download/' + fileID);
		
		setTimeout(function() {
			$('#loading').fadeOut(300);
			$('#player').fadeIn(300);
		}, 1000);
	
});
