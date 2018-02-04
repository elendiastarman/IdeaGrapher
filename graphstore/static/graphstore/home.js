"use strict;"

var svg = d3.select('#display');
var field;

var width = 1200,
    height = 900,
    fieldX = 0,
    fieldY = 0,
    fieldScale = 1,
    fX = fieldX,
    fY = fieldY,
    fS = fieldScale;

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

var startTime, loopTimer;
function init() {
	startTime = Date.now();

	load_data();

	svg.attr('width', width).attr('height', height).style('border', '1px solid black');
	svg.append('rect')
	  .attr('id', 'background')
	  .attr('width', width)
	  .attr('height', height)
	  .attr('fill', 'white');

	field = svg.append('g')
	  .attr('id', 'field')
	  .attr('transform', 'translate(' + (fieldX) + ', ' + (fieldY) + ')');

	syncDataAndGraphics();

	drawSync();

	$('#start').on('click', start);
	$('#stop').on('click', stop);
	$('#step').on('click', step);

	svg.on('mousedown', handleMouseDown);
	svg.on('mouseup', handleMouseUp);
	svg.on('mousemove', handleMouseMove);
	svg.on('wheel.zoom', handleMouseScroll);
	svg.on('contextmenu', function(){ d3.event.preventDefault(); });

	// start();
	var delay = 20;
	loopTimer = setInterval(step, delay);
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
			'xv': 0,
			'yv': 0,
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
	  .attr('stroke', 'black')
	vEnterGroup.append('text')
	  .text(function(d){ return nodes[d]['shortname']})
	  .attr('x', function(d){ return vertices[d]['x']; })
	  .attr('y', function(d){ return vertices[d]['y']; })
	  .attr('class', 'outer')
	  .attr('text-anchor', 'middle')
	  .attr('alignment-baseline', 'central')
	  .style('fill', 'white')
	  .style('stroke', 'black');
	vEnterGroup.append('text')
	  .text(function(d){ return nodes[d]['shortname']})
	  .attr('x', function(d){ return vertices[d]['x']; })
	  .attr('y', function(d){ return vertices[d]['y']; })
	  .attr('class', 'inner')
	  .attr('text-anchor', 'middle')
	  .attr('alignment-baseline', 'central')
	  .style('fill', 'white')
	  .style('stroke', 'white');

	vData.exit().remove();

	draw();
}

function draw() {
	var vData = field.selectAll('.node');
	vData.selectAll('circle')
	  .attr('cx', function(d){ return vertices[d]['x']; })
	  .attr('cy', function(d){ return vertices[d]['y']; })
	  .attr('r', function(d){ return Math.sqrt(parseFloat(vertices[d]['node']['size'])) * 2 / fS; })
	  .attr('stroke-width', (2 / fS) + 'px');
	vData.selectAll('text')
	  .attr('x', function(d){ return vertices[d]['x']; })
	  .attr('y', function(d){ return vertices[d]['y']; })
	  .attr('font-size', 16 / fS );
	vData.selectAll('text.outer')
	  .style('stroke-width', 5 / fS);
	vData.selectAll('text.inner')
	  .style('stroke-width', 1 / fS);

	var eData = field.selectAll('.link');
	eData.selectAll('line')
	  .attr('x1', function(d){ return edges[d]['start']['x']; })
	  .attr('y1', function(d){ return edges[d]['start']['y']; })
	  .attr('x2', function(d){ return edges[d]['end']['x']; })
	  .attr('y2', function(d){ return edges[d]['end']['y']; })
	  .attr('stroke-width', function(d){ return (2 / fS) + 'px'; });

	field.attr('transform', 'translate(' + (fX * fS + width/2) + ', ' + (fY * fS + height/2) + ') scale(' + (fS) + ')');
}

doPhysics = false;
function start() {
	doPhysics = true;
}

function stop() {
	doPhysics = false;
}

function step() {
	updateMouseState();
	respondToInput();

	executeContinuousTriggers();
	executeChangeTriggers();

	if (doPhysics) {
		stepPhysics();
	}

	draw();
}

var cumulativeAccel = {};
var twiddle = 0.1;
var stepSize = 0.1;
var initDrag = 1;

function stepPhysics() {
	var logger = [false, false];

	for(nid in nodes) {
		cumulativeAccel[nid] = origingravity(nid);
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

		cumulativeAccel[nids[0]][0] += offset[0];
		cumulativeAccel[nids[0]][1] += offset[1];
		cumulativeAccel[nids[1]][0] += offset[2];
		cumulativeAccel[nids[1]][1] += offset[3];
	}

	drag = initDrag / Math.pow((Date.now() - startTime) / 500000 + 1, 1./4);
	for(nid in nodes) {
		vertices[nid]['xv'] = drag * (vertices[nid]['xv'] + stepSize * cumulativeAccel[nid][0]);
		vertices[nid]['yv'] = drag * (vertices[nid]['yv'] + stepSize * cumulativeAccel[nid][1]);

		vertices[nid]['x'] += stepSize * vertices[nid]['xv'];
		vertices[nid]['y'] += stepSize * vertices[nid]['yv'];
	}
}

var maxForceStrength = 2;
var minForceStrength = -maxForceStrength;
var minDist = 2;

function displace(n1id, n2id, link) {
	var closenessMultiplier = 1;
	var strengthMultiplier = 1.1;
	var n1x = vertices[n1id]['x'],
	    n1y = vertices[n1id]['y'],
	    n2x = vertices[n2id]['x'],
	    n2y = vertices[n2id]['y'];

	var dist = Math.sqrt(Math.pow(n1x - n2x, 2) + Math.pow(n1y - n2y, 2));
	dist = Math.max(dist, minDist);

	var diff = link['closeness'] * closenessMultiplier - dist;
	var force = diff * link['strength'] * strengthMultiplier * twiddle;

	force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

	var off1x = force * (n1x - n2x) / dist,
		off1y = force * (n1y - n2y) / dist,
		off2x = force * (n2x - n1x) / dist,
		off2y = force * (n2y - n1y) / dist;

	return [off1x, off1y, off2x, off2y];
}

function antigravity(n1id, n2id) {
	var closenessMultiplier = 1;
	var strengthMultiplier = 1;
	var n1x = vertices[n1id]['x'],
	    n1y = vertices[n1id]['y'],
	    n2x = vertices[n2id]['x'],
	    n2y = vertices[n2id]['y'];

	var dist = Math.sqrt(Math.pow(n1x - n2x, 2) + Math.pow(n1y - n2y, 2));
	dist = Math.max(dist, minDist);
	// var diff = link['closeness'] * closenessMultiplier - dist;
	// var force = diff * link['strength'] * strengthMultiplier;
	var force = 10 * twiddle / Math.sqrt(dist + 10);

	force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

	var off1x = force * (n1x - n2x) / dist,
		off1y = force * (n1y - n2y) / dist,
		off2x = force * (n2x - n1x) / dist,
		off2y = force * (n2y - n1y) / dist;

	return [off1x, off1y, off2x, off2y];
}

function origingravity(nid) {
	var nx = vertices[nid]['x'],
	    ny = vertices[nid]['y'];
	var dist = Math.sqrt(nx*nx + ny*ny);
	dist = Math.max(dist, minDist);

	var force = -1./20 * twiddle * Math.pow(dist + 100, 1./1);

	force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

	var offx = force * nx / dist;
	    offy = force * ny / dist;

	return [offx, offy];
}

function dis(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}


var now = Date.now();
var mouseEvents = [[[null, null]], [], [], [], []]; // mousemove, left button, middle button, right button
var mouseEventTimes = [now, now, now, now, now];
var mouseState = {"state": "hover", "scrollTime": 0};

function handleMouseDown() {
	d3.event.preventDefault();
	// console.log(d3.event);
	mouseEvents[d3.event.which].unshift([d3.event, null]);
	mouseEvents[0].unshift([d3.event, null]);
	mouseEventTimes[d3.event.which] = Date.now();
}

function handleMouseUp() {
	d3.event.preventDefault();
	mouseEvents[d3.event.which][0][1] = d3.event;
	mouseEvents[0].unshift([d3.event, null]);
	mouseEventTimes[d3.event.which] = Date.now();
}

function handleMouseMove() {
	d3.event.preventDefault();
	mouseEvents[0][0][1] = d3.event;
	mouseEventTimes[0] = Date.now();
}

function handleMouseScroll() {
	d3.event.preventDefault();
	mouseEvents[4].unshift(d3.event);
	mouseEventTimes[4] = Date.now();
	// console.log(d3.event);
}

var moveDis = 10;
var holdTime = 400;
var clickWaitTime = 300;

function updateMouseState() {
	now = Date.now();
	var buttonsDown = (mouseEvents[1].length && mouseEvents[1][0][1] == null) * 1 + (mouseEvents[2].length && mouseEvents[2][0][1] == null) * 2 + (mouseEvents[3].length && mouseEvents[3][0][1] == null) * 4;
	// console.log("buttonsDown: ", buttonsDown);
	// var buttonsDownTime = Math.min(mouseEventTimes[1], mouseEventTimes[2], mouseEventTimes[3]);
	var oldState = mouseState["state"];

	// hover -> down
	if(mouseState["state"] == "hover") {

		// down -> down
		if(buttonsDown > 0) {
			mouseState["state"] = "down";
		}

	}

	// down -> click, hold, drag
	else if (mouseState["state"] == "down") {

		// up -> click
		if(buttonsDown == 0) {
			mouseState["state"] = "click";
			mouseState["clicks"] = 1;
		}

		// wait -> hold
		else if (now - mouseState["time"] > holdTime) {
			mouseState["state"] = "hold";
		}

		// move -> drag
		else if (mouseEvents[0][0][1] != null) {
			var a = mouseEvents[0][0][0],
				b = mouseEvents[0][0][1];

			if(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) > Math.pow(moveDis, 2)) {
				mouseState["state"] = "drag";
			}
		}
	}

	// click -> hover, click-down
	else if (mouseState["state"] == "click") {

		// down -> click-down
		if(buttonsDown > 0) {
			mouseState["state"] = "click-down";
		}

		// wait -> hover
		else if (now - mouseState["time"] > clickWaitTime) {
			mouseState["state"] = "hover";
			mouseState["clicks"] = 0;
		}
	}

	// click-down -> click, click-drag, click-hold
	else if (mouseState["state"] == "click-down") {

		// up -> click
		if(buttonsDown == 0) {
			mouseState["state"] = "click";
			mouseState["clicks"] += 1;
		}

		// wait -> click-hold
		else if (now - mouseState["time"] > holdTime) {
			mouseState["state"] = "click-hold";
		}

		// move -> click-drag
		else if (mouseEvents[0][0][1] != null) {
			var a = mouseEvents[0][0][0],
				b = mouseEvents[0][0][1];

			if(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) > Math.pow(moveDis, 2)) {
				mouseState["state"] = "click-drag";
			}
		}
	}

	// click-drag, click-hold, hold, hold-drag, drag, drag-hold + up -> hover
	else if (buttonsDown == 0 && ["click-drag", "click-hold", "hold", "hold-drag", "drag", "drag-hold"].includes(mouseState["state"])) {
		mouseState["state"] = "hover";
		mouseState["clicks"] = 0;
	}

	// hold -> hold-drag
	else if (mouseState["state"] == "hold") {

		// move -> hold-drag
		if(mouseEvents[0][0][1] != null) {
			var a = mouseEvents[0][0][0],
				b = mouseEvents[0][0][1];

			if(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) > Math.pow(moveDis, 2)) {
				mouseState["state"] = "hold-drag";
			}
		}
	}

	// drag -> drag-hold

	// known states and nothing to do
	else if (["click", "click-drag", "click-hold", "hold", "hold-drag", "drag", "drag-hold"].includes(mouseState["state"])) {
		// pass
	}

	// unknown state
	else {
		console.log("ERROR! Unknown/invalid state: " + mouseState["state"])
	}

	if(mouseEvents[4].length && mouseEventTimes[4] > mouseState["scrollTime"]) {
		mouseState["scroll"] = [mouseEvents[4][0].deltaX, mouseEvents[4][0].deltaY]
		mouseState["scrollTime"] = mouseEventTimes[4];
	} else {
		mouseState["scroll"] = [0, 0];
	}

	mouseState["buttons"] = buttonsDown;
	if(mouseState["state"] != oldState) {
		mouseState["time"] = now;
		executeChangeTriggers(oldState, mouseState["state"]);
		// console.log("Mouse state: ", mouseState["state"]);

		if(mouseState["state"] == "click") {
			console.log("Clicks: ", mouseState["clicks"]);
		}
	}
}

function respondToInput() {

	if(mouseState["scroll"][1] < 0) {
		fS = fieldScale * 1.2;
	} else if (mouseState["scroll"][1] > 0) {
		fS = fieldScale / 1.2;
	} else {
		fS = fieldScale;
	}
	fieldScale = fS;
}

function executeContinuousTriggers() {
	for(index in continuousTriggers) {
		group = continuousTriggers[index];
		// console.log("group: ", group);
		if(group[0].exec(mouseState["state"])) {
			for(fIndex in group[1]) {
				group[1][fIndex]();
			}
		}
	}
}

function executeChangeTriggers(oldState, newState) {
	for(index in changeTriggers) {
		group = changeTriggers[index];
		if(group[0].exec(oldState + '->' + newState)) {
			for(fIndex in group[1]) {
				group[1][fIndex]();
			}
		}
	}
}

function pan() {
	if(mouseState["buttons"] == 4) {
	    fX = (mouseEvents[0][0][1].x - mouseEvents[0][0][0].x) / fS + fieldX;
	    fY = (mouseEvents[0][0][1].y - mouseEvents[0][0][0].y) / fS + fieldY;
   	}
}

function panEnd() {
	fieldX = fX;
    fieldY = fY;
}

continuousTriggers = [
	[/drag/, [pan]],
]

changeTriggers = [
	[/drag->hover/, [panEnd]],
]

