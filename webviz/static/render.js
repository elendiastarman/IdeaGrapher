"use strict;"
// The following come from models-and-fields.js:
// Web, Graph, Vertex, Node

var svg = d3.select('#display');

var panes = {
  'global': {
    'width': 0,
    'height': 0,
  },
  'layout': {

  },
  'viz': {
    'pane': null,
    'clip': null,
    'contents': null,
    'x': 0,
    'y': 0,
    'scale': 1,
  },
  'selected': {
    'pane': null,
    'clip': null,
    'contents': null,
    'x': 0,
    'y': 0,
    'scale': 1,
  },
};

// For things like dragging or panning where it's useful to record the initial mouse position
var temp = {};

var models = {
  'nodes': new ModelLookup(Node),
  'vertices': new ModelLookup(Vertex),
  'links': new ModelLookup(Link),
  'edges': new ModelLookup(Edge),
  'graphs': new ModelLookup(Graph),
  'webs': new ModelLookup(Web),
  // 'rules': new ModelLookup(Rule),
};

// Miscellaneous variables that haven't been reorganized yet
var selected = [],
    pairs = {},
    paneSplitPercent = 0.75,
    paneSplitBorder = null,
    currentWeb = null;

$(document).ready(function(){ init(); });

var startTime, loopTimer;
function init() {
  startTime = Date.now();

  loadData();
  currentWeb = models['webs'].index(0);

  svg.style('border', '1px solid black');
  svg.append('rect')
    .attr('id', 'background')
    .attr('fill', 'white');

  let svgDefs = svg.append('defs');
  panes['viz']['clip'] = svgDefs.append('clipPath').attr('id', 'vizClip');
  panes['viz']['clip'].append('rect');
  panes['selected']['clip'] = svgDefs.append('clipPath').attr('id', 'selectedClip');
  panes['selected']['clip'].append('rect');

  paneSplitBorder = svg.append('rect')
    .attr('id', '#paneSplitBorder')
    .attr('y', 0)
    .attr('width', 3)
    .style('fill', 'black')
    .call(d3.drag().on('drag', dragPaneSplit));

  panes['viz']['pane'] = svg.append('g')
    .attr('id', 'vizPane')
    .style('clip-path', 'url(#vizClip)');
  panes['viz']['pane'].append('g').attr('id', 'vizHighlights');
  panes['viz']['pane'].append('g').attr('id', 'vizEdges');
  panes['viz']['pane'].append('g').attr('id', 'vizVertices');

  panes['selected']['pane'] = svg.append('g')
    .attr('id', 'selectedPane')
    .style('clip-path', 'url(#selectedClip)');
  panes['selected']['pane'].append('foreignObject')
    .attr('x', 5)
    .attr('y', 5);
  panes['selected']['contents'] = panes['selected']['pane'].select('foreignObject').append('xhtml:div')
    .attr('id', 'selectedContent')
    .attr('xmlns', 'http://www.w3.org/1999/xhtml')
    .style('overflow', 'auto');

  resizeSVG();
  populateSelectedPane();
  drawSync();

  $('#start').on('click', start);
  $('#stop').on('click', stop);
  $('#step').on('click', step);
  $('#webname').on('focusout', saveWebname);
  $(window).on('resize', resizeSVG);

  svg.on('mousedown', handleMouseDown);
  svg.on('mouseup', handleMouseUp);
  svg.on('mousemove', handleMouseMove);
  svg.on('wheel.zoom', handleMouseScroll);
  svg.on('contextmenu', function(){
    if (whichPane(d3.event)[0] == 'viz') {
      d3.event.preventDefault();
    }
  });

  // start();
  let delay = 20;
  loopTimer = setInterval(step, delay);
}

function pairKey(vertex1id, vertex2id) {
  if(vertex1id < vertex2id) {
    return vertex1id + '_' + vertex2id;
  } else {
    return vertex2id + '_' + vertex1id;
  }
}

function initNodes(data) {
  let nodesData = data['Node'] || [];
  for (let key in nodesData) {
    models['nodes'].add(new Node(nodesData[key]));
  }
}

function initVertices(data) {
  let verticesData = data['Vertex'] || [];
  for (let key in verticesData) {
    models['vertices'].add(new Vertex(verticesData[key]));
  }

  models['vertices'].modelIds.forEach(function(v1id) {
    models['vertices'].modelIds.forEach(function(v2id) {
      if(v1id != v2id) {
        pairs[pairKey(v1id, v2id)] = {vertex1: models['vertices'][v1id], vertex2: models['vertices'][v2id], edge: null};
      }
    });
  });
}

function initLinks(data) {
  let linksData = data['Link'] || [];
  for (let key in linksData) {
    models['links'].add(new Link(linksData[key]));
  }
}

function initEdges(data) {
  let edgesData = data['Edge'] || [];
  for (let key in edgesData) {
    models['edges'].add(new Edge(edgesData[key]));
  }
}

function initGraphs(data) {
  let graphsData = data['Graph'] || [];
  for (let key in graphsData) {
    models['graphs'].add(new Graph(graphsData[key]));
  }
}

function initWebs(data) {
  let websData = data['Web'] || [];
  for (let key in websData) {
    models['webs'].add(new Web(websData[key]));
  }
}

function loadData() {
  let data = JSON.parse($('#data > p').html());
  initNodes(data);
  initVertices(data);
  initLinks(data);
  initEdges(data);
  initGraphs(data);
  initWebs(data);
}

function resizeSVG() {
  let totalWidth = $(window).width(),
      totalHeight = $(window).height();

  let width = totalWidth - 15;
  let height = totalHeight - 150;
  panes['global']['width'] = width;
  panes['global']['height'] = height;

  svg.attr('width', width).attr('height', height);
  svg.select('#background')
    .attr('width', width)
    .attr('height', height);

  paneSplitBorder.attr('height', height).attr('x', paneSplitPercent * width - 1);

  adjustVizClip();
  adjustSelectedClip();
  draw();
}

function dragPaneSplit() {
  let x = d3.event.x,
      y = d3.event.y;

  paneSplitPercent = x / width;
  paneSplitBorder.attr('x', paneSplitPercent * width - 1);

  adjustVizClip();
  adjustSelectedClip();
  draw();
}

function adjustVizClip() {
  let vX = panes['viz']['x'],
      vY= panes['viz']['y'],
      vScale = panes['viz']['scale'],
      width = panes['global']['width'],
      height = panes['global']['height'];

  panes['viz']['clip'].select('rect')
    .attr('x', -vX - width * paneSplitPercent / vScale / 2)
    .attr('y', -vY- height / vScale / 2)
    .attr('width', width * paneSplitPercent / vScale)
    .attr('height', height / vScale);
}

function adjustSelectedClip() {
  let width = panes['global']['width'],
      height = panes['global']['height'];

  panes['selected']['pane'].select('foreignObject')
    .attr('width', width * (1 - paneSplitPercent) - 10)
    .attr('height', height - 10);
  panes['selected']['contents']
    .style('width', '100%')
    .style('height', '100%');
  panes['selected']['clip'].select('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width * (1 - paneSplitPercent) - 1)
    .attr('height', height);
}

function drawSync() {
  let vData = panes['viz']['pane'].select('#vizVertices').selectAll('.vertex').data(models['vertices'].modelIds, function(d){ return d; });
  let vEnterGroup = vData.enter().append('g')
    .attr('class', 'vertex')
    .attr('id', function(d){ return d; });
  vEnterGroup.append('circle')
    .attr('stroke', 'black');
  vEnterGroup.append('text')  // text: white outline
    .attr('class', 'outer')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .style('fill', 'white')
    .style('stroke', 'black');
  vEnterGroup.append('text')  // text: black core
    .attr('class', 'inner')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .style('fill', 'white')
    .style('stroke', 'white');

  vData.exit().remove();

  let eData = panes['viz']['pane'].select('#vizEdges').selectAll('.edge').data(models['edges'].modelIds, function(d){ return d; });
  let eGroup = eData.enter().append('g')
    .attr('class', 'edge')
    .attr('id', function(d){ return d; });
  eGroup.append('line')
    .attr('stroke', 'black')
    .attr('stroke-wdith', '2px');

  eData.exit().remove();

  draw();
}

function draw() {
  let vX = panes['viz']['x'],
      vY = panes['viz']['y'],
      vScale = panes['viz']['scale'],
      width = panes['global']['width'],
      height = panes['global']['height'];

  let vData = panes['viz']['pane'].select('#vizVertices').selectAll('.vertex').data(models['vertices'].modelIds, function(d){ return d; });
  vData.selectAll('circle')
    .attr('cx', function(d){ return models['vertices'][d]['screen']['x']; })
    .attr('cy', function(d){ return models['vertices'][d]['screen']['y']; })
    .attr('r', function(d){ return Math.sqrt(parseFloat(models['vertices'][d]['node']['data']['size'])); })
    .attr('stroke-width', (2 / vScale) + 'px')
    .attr('fill', function(d){ return models['vertices'][d]['screen']['color'] || 'gray'; });
  vData.selectAll('text')
    .attr('x', function(d){ return models['vertices'][d]['screen']['x']; })
    .attr('y', function(d){ return models['vertices'][d]['screen']['y']; })
    .text(function(d){ return models['vertices'][d]['data']['shortname']})
    .attr('font-size', 16 / vScale );
  vData.selectAll('text.outer')
    .style('stroke-width', 5 / vScale);
  vData.selectAll('text.inner')
    .style('stroke-width', 1 / vScale);

  let eData = panes['viz']['pane'].select('#vizEdges').selectAll('.edge').data(models['edges'].modelIds, function(d){ return d; });
  eData.selectAll('line')
    .attr('x1', function(d){ return models['edges'][d]['start_vertices'].value[0]['screen']['x']; })
    .attr('y1', function(d){ return models['edges'][d]['start_vertices'].value[0]['screen']['y']; })
    .attr('x2', function(d){ return models['edges'][d]['end_vertices'].value[0]['screen']['x']; })
    .attr('y2', function(d){ return models['edges'][d]['end_vertices'].value[0]['screen']['y']; })
    .attr('stroke-width', function(d){ return (2 / vScale) + 'px'; });

  panes['viz']['pane'].attr('transform', 'translate(' + (vX * vScale + width * paneSplitPercent / 2) + ', ' + (vY * vScale + height / 2) + ') scale(' + (vScale) + ')');
  panes['selected']['pane'].attr('transform', 'translate(' + (width * paneSplitPercent) + ', 0)');
}

function populateSelectedPane(element) {
  panes['selected']['contents'].selectAll('*').remove();

  if (element != null) {
    element._populateContainer(panes['selected']['contents']);
  } else {
    currentWeb._populateContainer(panes['selected']['contents']);
  }
}

function highlightSelected() {
  for (let index in selected) {
    let item = selected[index];
    // if
  }
}

doPhysics = false;
function start() {
  doPhysics = true;
}

function stop() {
  doPhysics = false;
}

function step() {
  let changed = false;
  changed = updateMouseState() || changed;
  changed = respondToScrollInput() || changed;
  changed = executeContinuousTriggers() || changed;

  if (doPhysics) {
    stepPhysics();
    changed = changed || true;
  }

  if (changed) {
    adjustVizClip();
    draw();
  }
}

function saveWebname() {
  let inputName = $('#webname').val();
  web = models['webs'].index(0);
  if (inputName != web['name'].value) {
    web['name'].value = inputName;

    $.ajax('/updatedata', {
      method: 'PUT',
      data: {'data': JSON.stringify([{
        '$model': 'web',
        '$id': web.id,
        '$update': [{
          '$action': 'overwrite',
          '$type': 'string',
          '$key': 'name',
          '$value': inputName,
        }],
      }])},
      success: function(responseData) {
        console.log('SUCCESS ', responseData);
      },
      error: function(responseData) {
        console.log('ERROR ', responseData);
      },
    });
  }
}

// var cumulativeAccel = {};
// var twiddle = 0.1;
// var stepSize = 0.1;
// var initDrag = 1;

// function stepPhysics() {
//   let logger = [false, false];

//   for (let vid in models['vertices']) {
//     cumulativeAccel[vid] = origingravity(vid);
//   }

//   for (let pairId in pairs) {
//     let pair = pairs[pairId];
//     let vids = pairId.split('_');
//     let offset;

//     if(pair['edge']) {
//       offset = displace(vids[0], vids[1], pair['edge']);
//     } else {
//       offset = antigravity(vids[0], vids[1]);
//     }

//     cumulativeAccel[vids[0]][0] += offset[0];
//     cumulativeAccel[vids[0]][1] += offset[1];
//     cumulativeAccel[vids[1]][0] += offset[2];
//     cumulativeAccel[vids[1]][1] += offset[3];
//   }

//   drag = initDrag / Math.pow((Date.now() - startTime) / 500000 + 1, 1./4);
//   for (let vid in models['vertices']) {
//     models['vertices'][vid]['screen']['xv'] = drag * (models['vertices'][vid]['screen']['xv'] + stepSize * cumulativeAccel[vid][0]);
//     models['vertices'][vid]['screen']['yv'] = drag * (models['vertices'][vid]['screen']['yv'] + stepSize * cumulativeAccel[vid][1]);

//     models['vertices'][vid]['screen']['x'] += stepSize * models['vertices'][vid]['screen']['xv'];
//     models['vertices'][vid]['screen']['y'] += stepSize * models['vertices'][vid]['screen']['yv'];
//   }
// }

// var maxForceStrength = 2;
// var minForceStrength = -maxForceStrength;
// var minDist = 2;

// function displace(v1id, v2id, link) {
//   let closenessMultiplier = 1;
//   let strengthMultiplier = 1.5;
//   let v1x = vertices[v1id]['screen']['x'],
//       v1y = vertices[v1id]['screen']['y'],
//       v2x = vertices[v2id]['screen']['x'],
//       v2y = vertices[v2id]['screen']['y'];

//   let dist = Math.sqrt(Math.pow(v1x - v2x, 2) + Math.pow(v1y - v2y, 2));
//   dist = Math.max(dist, minDist);

//   let diff = link['closeness'] * closenessMultiplier - dist;
//   let force = diff * link['strength'] * strengthMultiplier * twiddle;

//   force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

//   let off1x = force * (v1x - v2x) / dist,
//     off1y = force * (v1y - v2y) / dist,
//     off2x = force * (v2x - v1x) / dist,
//     off2y = force * (v2y - v1y) / dist;

//   return [off1x, off1y, off2x, off2y];
// }

// function antigravity(v1id, v2id) {
//   let closenessMultiplier = 1;
//   let strengthMultiplier = 1;
//   let v1x = vertices[v1id]['screen']['x'],
//       v1y = vertices[v1id]['screen']['y'],
//       v2x = vertices[v2id]['screen']['x'],
//       v2y = vertices[v2id]['screen']['y'];

//   let dist = Math.sqrt(Math.pow(v1x - v2x, 2) + Math.pow(v1y - v2y, 2));
//   dist = Math.max(dist, minDist);
//   // let diff = link['closeness'] * closenessMultiplier - dist;
//   // let force = diff * link['strength'] * strengthMultiplier;
//   let force = 10 * twiddle / Math.pow(dist + 100, 1/2);

//   force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

//   let off1x = force * (v1x - v2x) / dist,
//     off1y = force * (v1y - v2y) / dist,
//     off2x = force * (v2x - v1x) / dist,
//     off2y = force * (v2y - v1y) / dist;

//   return [off1x, off1y, off2x, off2y];
// }

// function origingravity(vid) {
//   let vertx = vertices[vid]['screen']['x'],
//       verty = vertices[vid]['screen']['y'];
//   let dist = Math.sqrt(vertx * vertx + verty * verty);
//   dist = Math.max(dist, minDist);

//   let force = -1./20 * twiddle * Math.pow(dist + 100, 1./1);

//   force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

//   let offx = force * vertx / dist;
//       offy = force * verty / dist;

//   return [offx, offy];
// }

// function dis(x1, y1, x2, y2) {
//   return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
// }


var now = Date.now();
var mouseEvents = [[[null, null]], [], [], [], []]; // mousemove, left button, middle button, right button, scroll wheel
var mouseEventTimes = [now, now, now, now, now];
var mouseState = {
  "state": "hover",
  "scrollTime": 0,
  "changed": false,
  "scrolled": false,
  "lastPressed": null,
  "lastReleased": null,
};

function handleMouseDown() {
  if (whichPane(d3.event)[0] == 'viz') {
    d3.event.preventDefault();
  }
  mouseState['changed'] = true;

  mouseEvents[d3.event.which].unshift([d3.event, null]);
  mouseEvents[0].unshift([d3.event, null]);
  mouseEventTimes[d3.event.which] = Date.now();
  mouseState['lastPressed'] = d3.event.which;
}

function handleMouseUp() {
  if (whichPane(d3.event)[0] == 'viz') {
    d3.event.preventDefault();
  }
  mouseState['changed'] = true;

  mouseEvents[d3.event.which][0][1] = d3.event;
  mouseEvents[0].unshift([d3.event, null]);
  mouseEventTimes[d3.event.which] = Date.now();
  mouseState['lastReleased'] = d3.event.which;
}

function handleMouseMove() {
  if (whichPane(d3.event)[0] == 'viz') {
    d3.event.preventDefault();
  }
  mouseState['changed'] = true;

  mouseEvents[0][0][1] = d3.event;
  mouseEventTimes[0] = Date.now();
}

function handleMouseScroll() {
  if (whichPane(d3.event)[0] == 'viz') {
    d3.event.preventDefault();
  }
  mouseState['changed'] = true;
  mouseState['scrolled'] = true;

  mouseEvents[4].unshift(d3.event);
  mouseEventTimes[4] = Date.now();
}

var moveDis = 5;
var holdTime = 400;
var clickWaitTime = 300;

function updateMouseState() {
  now = Date.now();
  let buttonsDown = (mouseEvents[1].length && mouseEvents[1][0][1] == null) * 1 + (mouseEvents[2].length && mouseEvents[2][0][1] == null) * 2 + (mouseEvents[3].length && mouseEvents[3][0][1] == null) * 4;
  // console.log("buttonsDown: ", buttonsDown);
  // let buttonsDownTime = Math.min(mouseEventTimes[1], mouseEventTimes[2], mouseEventTimes[3]);
  let oldState = mouseState["state"];

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
      let a = mouseEvents[0][0][0],
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
      let a = mouseEvents[0][0][0],
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
      let a = mouseEvents[0][0][0],
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
  }

  let changed = mouseState['changed'];
  mouseState['changed'] = false;
  return changed;
}

function respondToScrollInput() {
  if (!mouseState['scrolled']) {
    return false;
  }
  if(mouseState["scroll"][1] == 0) {
    return false;
  }

  mouseState['scrolled'] = false;

  let [pane, mouseX, mouseY] = normalizeMousePosition(mouseEvents[4][0]);
  if (pane != 'viz') {
    return false;
  }

  let dispX, dispY, scaleFactor;

  if(mouseState["scroll"][1] < 0) {
    scaleFactor = 1.2;
  } else if (mouseState["scroll"][1] > 0) {
    scaleFactor = 1 / 1.2;
  }

  dispX = panes['viz']['x'] + mouseX;
  dispY = panes['viz']['y'] + mouseY;
  panes['viz']['x'] += dispX * (1 / scaleFactor - 1);
  panes['viz']['y'] += dispY * (1 / scaleFactor - 1);
  panes['viz']['scale'] *= scaleFactor;

  return true;
}

function executeContinuousTriggers() {
  let changed = false;

  for(index in continuousTriggers) {
    group = continuousTriggers[index];
    if(group[0].exec(mouseState["state"])) {
      for(fIndex in group[1]) {
        group[1][fIndex]();
        changed = true;
      }
    }
  }

  return changed;
}

function executeChangeTriggers(oldState, newState) {
  let changed = false;

  for(index in changeTriggers) {
    group = changeTriggers[index];
    if(group[0].exec(oldState + '->' + newState)) {
      for(fIndex in group[1]) {
        group[1][fIndex]();
        changed = true;
      }
    }
  }

  return changed;
}

function drag() {
  if (temp['pan'] != undefined) {
    return pan();
  }
  if (temp['dragVertex'] != undefined) {
    return dragVertex();
  }

  let [pane, x, y] = normalizeMousePosition(mouseEvents[0][0][0]);
  if (pane != 'viz') {
    return;
  }

  let vert_max_dist = function(vert){ return Math.sqrt(vert['node']['data']['size']); };

  let targets = identifyTargets(x, y, [['vertices', vert_max_dist]]);

  if (targets[0][0] == null) {
    pan();
  } else if (targets[0][0] instanceof Vertex) {
    dragVertex(targets[0][0]);
  }
}

function dragEnd() {
  if (temp['pan'] != undefined) {
    delete temp['pan'];
  }
  if (temp['dragVertex'] != undefined) {
    delete temp['dragVertex'];
  }
}

function pan() {
  if(mouseState["buttons"] == 1 && whichPane(mouseEvents[0][0][0])[0] == 'viz') {
    if (temp['pan'] == null) {
      temp['pan'] = {
        'startX': panes['viz']['x'],
        'startY': panes['viz']['y'],
      };
    }

    panes['viz']['x'] = (mouseEvents[0][0][1].x - mouseEvents[0][0][0].x) / panes['viz']['scale'] + temp['pan']['startX'];
    panes['viz']['y'] = (mouseEvents[0][0][1].y - mouseEvents[0][0][0].y) / panes['viz']['scale'] + temp['pan']['startY'];
    adjustVizClip();
  }
}

function dragVertex(vertex) {
  if(mouseState["buttons"] == 1 && whichPane(mouseEvents[0][0][0])[0] == 'viz') {
    if (temp['dragVertex'] == null) {
      temp['dragVertex'] = {
        'startX': vertex['screen']['x'],
        'startY': vertex['screen']['y'],
        'vertex': vertex,
      };
    } else {
      vertex = temp['dragVertex']['vertex'];
    }

    vertex['screen']['x'] = (mouseEvents[0][0][1].x - mouseEvents[0][0][0].x) / panes['viz']['scale'] + temp['dragVertex']['startX'];
    vertex['screen']['y'] = (mouseEvents[0][0][1].y - mouseEvents[0][0][0].y) / panes['viz']['scale'] + temp['dragVertex']['startY'];
  }
}

function whichPane(event) {
  let boundingRect = document.getElementById('display').getBoundingClientRect();
  let realX = event.x - boundingRect.x;
  let realY = event.y - boundingRect.y;
  let pane = null;

  if (realX < panes['global']['width'] * paneSplitPercent) {
    pane = 'viz';
  } else {
    pane = 'selected';
  }

  return [pane, realX, realY];
}

function normalizeMousePosition(event) {
  let [pane, realX, realY] = whichPane(event);
  let x, y;
  let width = panes['global']['width'],
      height = panes['global']['height'];

  if (pane == 'viz') {
    x = (realX - width * paneSplitPercent / 2) / panes['viz']['scale'] - panes['viz']['x'];
    y = (realY - height / 2) / panes['viz']['scale'] - panes['viz']['y'];
  } else if (pane == 'selected') {
    x = realX - width * paneSplitPercent;
    y = realY - height;
  }

  return [pane, x, y];
}

function identifyTargets(x, y, types) {
  let targets = [[null, Infinity]];
  types = types || [];

  for (let index in types) {
    let [type, max_dist] = types[index];
    max_dist = max_dist || function(){ return Infinity; };

    if (type == 'vertices') {
      for (let vertex of models['vertices']) {
        let vx = vertex['screen']['x'];
        let vy = vertex['screen']['y'];
        let dist = Math.sqrt((vx - x)**2 + (vy - y)**2);

        if (dist < max_dist(vertex)) {
          targets.push([vertex, dist]);
        }
      }
    } else if (type == 'edges') {
      for (let edge of models['edges']) {
        let x0 = x,
            y0 = y,
            x1 = edge['start_vertices'].value[0]['screen']['x'],
            y1 = edge['start_vertices'].value[0]['screen']['y'],
            x2 = edge['end_vertices'].value[0]['screen']['x'],
            y2 = edge['end_vertices'].value[0]['screen']['y'];

        // Eq. (14) here: http://mathworld.wolfram.com/Point-LineDistance2-Dimensional.html
        let dist = Math.abs((x2 - x1) * (y1 - y0) - (x1 - x0) * (y2 - y1)) / Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);

        if (dist < max_dist(edge)) {
          targets.push([edge, dist]);
        }
      }
    }
  }

  targets.sort(function(a, b){ return a[1] - b[1]; })
  return targets
}

function createVertex() {
  let [pane, x, y] = normalizeMousePosition(mouseEvents[1][0][0]);
  if (pane != 'viz') {
    return;
  }

  let newNode = new Node(Node._defaultData({'data': {'size': 100}}), false);
  let newVertex = new Vertex(Vertex._defaultData({'screen': {'x': x, 'y': y}, 'node': newNode.id, 'data': {'shortname': 'text'}}), false);
  models['nodes'].add(newNode);
  models['vertices'].add(newVertex);

  models['graphs'].index(0)['nodes'].push(newNode.id);
  models['webs'].index(0)['vertices'].push(newVertex.id);

  drawSync();
}

function makeEdge(start_vertex, end_vertex) {
  let newLink = new Link(Link._defaultData({'sources': [start_vertex['node'].value.id], 'sinks': [end_vertex['node'].value.id]}), false);
  let newEdge = new Edge(Edge._defaultData({'start_vertices': [start_vertex.id], 'end_vertices': [end_vertex.id], 'link': newLink.id}), false);
  models['links'].add(newLink);
  models['edges'].add(newEdge);

  models['graphs'].index(0)['links'].push(newLink.id);
  models['webs'].index(0)['edges'].push(newEdge.id);

  drawSync();
}

function selectClosestElement() {
  let [pane, x, y] = normalizeMousePosition(mouseEvents[0][0][0]);
  if (pane != 'viz') {
    return;
  }

  let vert_max_dist = function(vertex){
    return Math.sqrt(vertex['node']['data']['size']);
  };
  let edge_max_dist = function(edge){
    return 5;
  };

  let targets = identifyTargets(x, y, [['vertices', vert_max_dist], ['edges', edge_max_dist]]);

  if (targets.length <= 1) {
    populateSelectedPane();
    highlightSelected();
    return;
  }

  console.log(targets);

  if (temp['makingEdge'] != undefined) {
    let end = null;

    for (let index in targets) {
      let target = targets[index][0];

      if (target instanceof Vertex) {
        end = target;
        break;
      }

    }

    if (end) {
      makeEdge(temp['makingEdge']['start'], end);
    }

    delete temp['makingEdge'];

  } else if (mouseState['lastReleased'] == 3) {
    let start = null;

    for (let index in targets) {
      let target = targets[index][0];

      if (target instanceof Vertex) {
        start = target;
        break;
      }
    }

    if (start) {
      temp['makingEdge'] = {'start': start};
      selected.push(start);
      populateSelectedPane(start);
      highlightSelected();
    }

  } else if (mouseState['lastReleased'] == 1) {

    // deselect any currently selected vertices
    let i = 0;
    while (i < selected.length) {
      if (selected[i]['type'] == 'vertex') {
        selected.splice(i, 1);
      } else {
        i += 1;
      }
    }

    selected.push(targets[0][0]);
    populateSelectedPane(targets[0][0]);
    highlightSelected();
  }
}

function multiClick() {
  if (mouseState['clicks'] == 1) {
    selectClosestElement();
  } else if (mouseState['clicks'] == 2) {
    createVertex();
  }
}

continuousTriggers = [
  [/drag/, [drag]],
]

changeTriggers = [
  [/drag->hover/, [dragEnd]],
  [/(click-)?down->click/, [multiClick]],
]
