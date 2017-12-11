"use strict;"

var svg = d3.select('#display');
var field;

var width = 800,
    height = 600;

var nodes = {}
    nodeIds = [],
	links = {},
	linkIds = [],
	graphs = {},
	graphIds = [],
	vertices = {},
	edges = {};

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

	draw();
}

function load_data() {
	$('#nodes p').each(function(i, e){
		var data = JSON.parse($(e).html());
		console.log(i, data);
		nodes[data['id']] = data;
		nodeIds.push(data['id']);
	});

	$('#links p').each(function(i, e){
		var data = JSON.parse($(e).html());
		console.log(i, data);
		links[data['id']] = data;
		linkIds.push(data['id']);

		data['sources'].forEach(function(e, i){
			var node = nodes[e];
			if (node){
				data['sources'][i] = node;
			}
		});

		data['sinks'].forEach(function(e, i){
			var node = nodes[e];
			if (node){
				data['sinks'][i] = node;
			}
		});
	});

	$('#graphs p').each(function(i, e){
		var data = JSON.parse($(e).html());
		console.log(i, data);
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

function draw() {
	var vData = field.selectAll('.node').data(nodeIds);
	var vGroup = vData.enter().append('g')
	  .attr('class', 'node')
	  .attr('id', function(d){ return d; });
	vGroup.append('circle')
	  .attr('fill', 'gray')
	  .attr('cx', function(d){ return vertices[d]['x']; })
	  .attr('cy', function(d){ return vertices[d]['y']; })
	  .attr('r', 50)
	  .attr('stroke', 'black')
	  .attr('stroke-wdith', '1px');
	vGroup.append('text')
	  .text(function(d){ return nodes[d]['shortname']})
	  .attr('x', function(d){ return vertices[d]['x']; })
	  .attr('y', function(d){ return vertices[d]['y']; })
	  .attr('color', 'black')
	  .attr('text-anchor', 'middle')
	  .attr('alignment-baseline', 'central');

	var eData = field.selectAll('.link').data(linkIds);
	var eGroup = eData.enter().append('g')
	  .attr('class', 'link')
	  .attr('id', function(d){ return d; });
	eGroup.append('line')
	  .attr('x1', function(d){ return edges[d]['start']['x']; })
	  .attr('y1', function(d){ return edges[d]['start']['y']; })
	  .attr('x2', function(d){ return edges[d]['end']['x']; })
	  .attr('y2', function(d){ return edges[d]['end']['y']; })
	  .attr('stroke', 'black')
	  .attr('stroke-wdith', '2px');
}
