"use strict;"

var svg = d3.select('#display');
var field;

var width = 1600,
    height = 1200;

var nodes = {}
    nodeIds = [],
	links = {},
	linkIds = [],
	graphs = {},
	graphIds = [],
	vertices = {},
	edges = {},
	pairs = {};

$(document).ready(function(){ init(); });

function init() {
	load_data();

	svg.attr('width', width).attr('height', height).style('border', '1px solid black');
	svg.append('rect')
	  .attr('id', 'background')
	  .attr('width', width)
	  .attr('height', height)
	  .attr('fill', 'white');

	field = svg.append('g')
	  .attr('id', 'field')
	  .attr('transform', 'translate(' + (width/2) + ', ' + (height/2) + ')');

	syncDataAndGraphics();

	drawSync();

	$('#start').on('click', start);
	$('#stop').on('click', stop);
	$('#step').on('click', step);
}

function pairKey(node1id, node2id) {
	if(node1id < node2id) {
		return node1id + '_' + node2id;
	} else {
		return node2id + '_' + node1id;
	}
}

function load_data() {
	$('#nodes p').each(function(i, e){
		var data = JSON.parse($(e).html());
		// console.log(i, data);
		nodes[data['id']] = data;
		nodeIds.push(data['id']);
	});

	nodeIds.forEach(function(n1id) {
		nodeIds.forEach(function(n2id) {
			if(n1id != n2id) {
				pairs[pairKey(n1id, n2id)] = {node1: nodes[n1id], node2: nodes[n2id], linked: false};
			}
		});
	});

	$('#links p').each(function(i, e){
		var data = JSON.parse($(e).html());
		// console.log(i, data);
		links[data['id']] = data;
		linkIds.push(data['id']);
		var sinksSet = false;

		data['sources'].forEach(function(e1, i1){
			var node = nodes[e1];
			if (node){
				data['sources'][i1] = node;
			}

			data['sinks'].forEach(function(e2, i2){
				if(!sinksSet) {
					var node = nodes[e2];
					if (node){
						data['sinks'][i2] = node;
					}
				}

				pairs[pairKey(e1, e2)]['linked'] = true;
				pairs[pairKey(e1, e2)]['link'] = data;
			});

			sinksSet = true;
		});
	});

	$('#graphs p').each(function(i, e){
		var data = JSON.parse($(e).html());
		// console.log(i, data);
		graphs[data['id']] = data;
		graphIds.push(data['id']);
	});
}

function syncDataAndGraphics() {
	nodeIds.forEach(function(id) {
		vertices[id] = {
			'node': nodes[id],
			'x': Math.random() * 400 - 200,
			'y': Math.random() * 400 - 200,
			'z': Math.random() * 400 - 200,
		};
	});

	linkIds.forEach(function(id) {
		edges[id] = {
			'link': links[id],
			'start': vertices[links[id]['sources'][0]['id']],
			'end': vertices[links[id]['sinks'][0]['id']],
		};
	});
}

function drawSync() {
	var eData = field.selectAll('.link').data(linkIds);
	var eGroup = eData.enter().append('g')
	  .attr('class', 'link')
	  .attr('id', function(d){ return d; });
	eGroup.append('line')
	  .attr('stroke', 'black')
	  .attr('stroke-wdith', '2px');

	eData.exit().remove();

	var vData = field.selectAll('.node').data(nodeIds);
	var vEnterGroup = vData.enter().append('g')
	  .attr('class', 'node')
	  .attr('id', function(d){ return d; });
	vEnterGroup.append('circle')
	  .attr('fill', 'gray')
	  .attr('r', function(d){ return Math.sqrt(parseFloat(vertices[d]['node']['size'])); })
	  .attr('stroke', 'black')
	  .attr('stroke-wdith', '1px');
	vEnterGroup.append('text')
	  .text(function(d){ return nodes[d]['shortname']})
	  .attr('x', function(d){ return vertices[d]['x']; })
	  .attr('y', function(d){ return vertices[d]['y']; })
	  .attr('color', 'black')
	  .attr('text-anchor', 'middle')
	  .attr('alignment-baseline', 'central');

	vData.exit().remove()

	draw();
}

function draw() {
	var vData = field.selectAll('.node');
	vData.selectAll('circle')
	  .attr('cx', function(d){ return vertices[d]['x']; })
	  .attr('cy', function(d){ return vertices[d]['y']; });
	vData.selectAll('text')
	  .attr('x', function(d){ return vertices[d]['x']; })
	  .attr('y', function(d){ return vertices[d]['y']; });

	var eData = field.selectAll('.link');
	eData.selectAll('line')
	  .attr('x1', function(d){ return edges[d]['start']['x']; })
	  .attr('y1', function(d){ return edges[d]['start']['y']; })
	  .attr('x2', function(d){ return edges[d]['end']['x']; })
	  .attr('y2', function(d){ return edges[d]['end']['y']; });
}

var loopTimer;
function start() {
	var delay = 30;
	if(!loopTimer) {
		loopTimer = setInterval(step, delay);
	}
}

function stop() {
	if(loopTimer) {
		clearInterval(loopTimer);
		loopTimer = null;
	}
}

function step() {
	stepPhysics();
	draw();
}

var cumulativeOffset = {};
var twiddle = 0.1;
function stepPhysics() {
	var logger = [false, false];

	for(nid in nodes) {
		cumulativeOffset[nid] = [0, 0, 0];
	}

	for(pairId in pairs) {
		var pair = pairs[pairId];
		var nids = pairId.split('_');
		var offset;

		if(pair['linked']) {
			offset = displace(nids[0], nids[1], pair['link']);
		} else {
			offset = antigravity(nids[0], nids[1]);
		}

		cumulativeOffset[nids[0]][0] += offset[0];
		cumulativeOffset[nids[0]][1] += offset[1];
		cumulativeOffset[nids[0]][2] += offset[2];
		cumulativeOffset[nids[1]][0] += offset[3];
		cumulativeOffset[nids[1]][1] += offset[4];
		cumulativeOffset[nids[1]][2] += offset[5];
	}

	for(nid in nodes) {
		vertices[nid]['x'] += cumulativeOffset[nid][0];
		vertices[nid]['y'] += cumulativeOffset[nid][1];
		vertices[nid]['z'] += cumulativeOffset[nid][2];
	}
}

function displace(n1id, n2id, link) {
	var closenessMultiplier = 1;
	var strengthMultiplier = 1;
	var n1x = vertices[n1id]['x'],
	    n1y = vertices[n1id]['y'],
	    n1z = vertices[n1id]['z'],
	    n2x = vertices[n2id]['x'],
	    n2y = vertices[n2id]['y'],
	    n2z = vertices[n2id]['z'];

	var dist = Math.sqrt(Math.pow(n1x - n2x, 2) + Math.pow(n1y - n2y, 2) + Math.pow(n1z - n2z, 2));
	var diff = link['closeness'] * closenessMultiplier - dist;
	var force = diff * link['strength'] * strengthMultiplier * twiddle;

	var off1x = force * (n1x - n2x) / dist,
		off1y = force * (n1y - n2y) / dist,
		off1z = force * (n1z - n2z) / dist,
		off2x = force * (n2x - n1x) / dist,
		off2y = force * (n2y - n1y) / dist,
		off2z = force * (n2z - n1z) / dist;

	return [off1x, off1y, off1z, off2x, off2y, off2z];
}

function antigravity(n1id, n2id) {
	var closenessMultiplier = 1;
	var strengthMultiplier = 1;
	var n1x = vertices[n1id]['x'],
	    n1y = vertices[n1id]['y'],
	    n1z = vertices[n1id]['z'],
	    n2x = vertices[n2id]['x'],
	    n2y = vertices[n2id]['y'],
	    n2z = vertices[n2id]['z'];

	var dist = Math.sqrt(Math.pow(n1x - n2x, 2) + Math.pow(n1y - n2y, 2) + Math.pow(n1z - n2z, 2));
	// var diff = link['closeness'] * closenessMultiplier - dist;
	// var force = diff * link['strength'] * strengthMultiplier;
	var force = 10 * twiddle / Math.sqrt(dist);

	var off1x = force * (n1x - n2x) / dist,
		off1y = force * (n1y - n2y) / dist,
		off1z = force * (n1z - n2z) / dist,
		off2x = force * (n2x - n1x) / dist,
		off2y = force * (n2y - n1y) / dist,
		off2z = force * (n2z - n1z) / dist;

	return [off1x, off1y, off1z, off2x, off2y, off2z];
}

function dis(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2) + Math.pow(z1 - z2, 2));
}

function handleMouseDown(d, i) {
	//
}

function handleMouseUp(d, i) {
	//
}

