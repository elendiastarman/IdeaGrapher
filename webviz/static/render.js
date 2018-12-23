"use strict;"
// The following come from models-and-fields.js:
// Web, Graph, Vertex, Node

// console.log(Web);

var svg = d3.select('#display');
var fieldPane, fieldClip, dataPane, dataPaneContent, dataClip, paneSplitBorder, svgDefs;

var width = 1200,
    height = 900,
    fieldPaneX = 0,
    fieldPaneY = 0,
    fieldPaneScale = 1,
    fX = fieldPaneX,
    fY = fieldPaneY,
    fS = fieldPaneScale,
    dataPaneX = 0,
    dataPaneY = 0,
    dataPaneScale = 1,
    dX = dataPaneX,
    dY = dataPaneY,
    dS = dataPaneScale,
    paneSplitPercent = 0.75;

var nodes = {}
    nodeIds = [],
    links = {},
    linkIds = [],
    graphs = {},
    graphIds = [],
    vertices = {}
    vertexIds = [],
    edges = {},
    edgeIds = [],
    webs = {},
    webIds = [],
    vertices = {},
    selected = [],
    edges = {},
    pairs = {};

$(document).ready(function(){ init(); });

var startTime, loopTimer;
function init() {
  startTime = Date.now();

  loadData();

  svg.style('border', '1px solid black');
  svg.append('rect')
    .attr('id', 'background')
    .attr('fill', 'white');

  svgDefs = svg.append('defs');
  fieldClip = svgDefs.append('clipPath').attr('id', 'fieldClip');
  fieldClip.append('rect');
  dataClip = svgDefs.append('clipPath').attr('id', 'dataClip');
  dataClip.append('rect');

  paneSplitBorder = svg.append('rect')
    .attr('id', '#paneSplitBorder')
    .attr('y', 0)
    .attr('width', 3)
    .style('fill', 'black')
    .call(d3.drag().on('drag', dragPaneSplit));

  fieldPane = svg.append('g')
    .attr('id', 'fieldPane')
    .style('clip-path', 'url(#fieldClip)');

  dataPane = svg.append('g')
    .attr('id', 'dataPane')
    .style('clip-path', 'url(#dataClip)');
  dataPane.append('foreignObject')
    .attr('x', 5)
    .attr('y', 5);
  dataPane.select('foreignObject').append('xhtml:div')
    .attr('id', 'dataPaneContent')
    .attr('xmlns', 'http://www.w3.org/1999/xhtml');
  dataPaneContent = dataPane.select('#dataPaneContent');

  resizeSVG();
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
    if (whichPane(d3.event)[0] == 'field') {
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
  nodesData = data['Node'] || [];
  let newNodeIds = [];
  for (let key in nodesData) {
    let newNode = new Node(nodesData[key]);
    nodes[key] = newNode;
    nodeIds.push(key);
    newNodeIds.push(key);
  }

  return newNodeIds;
}

function initVertices(data) {
  verticesData = data['Vertex'] || [];
  let newVertexIds = [];
  for (let key in verticesData) {
    let newVertex = new Vertex(verticesData[key]);
    vertices[key] = newVertex;
    vertexIds.push(key);
    newVertexIds.push(key);

    // vertices[key]['node'] = nodes[verticesData[key]['node']];
  }

  vertexIds.forEach(function(v1id) {
    vertexIds.forEach(function(v2id) {
      if(v1id != v2id) {
        pairs[pairKey(v1id, v2id)] = {vertex1: vertices[v1id], vertex2: vertices[v2id], edge: null};
      }
    });
  });

  return newVertexIds;
}

function initLinks(data) {
  linksData = data['Link'] || [];
  let newLinkIds = [];
  for (let key in linksData) {
    links[key] = linksData[key];
    linkIds.push(key);
    newLinkIds.push(key);

    let needSinksSet = true;

    links[key]['sources'].forEach(function(id1, index1){
      links[key]['sources'][index1] = nodes[id1];

      links[key]['sinks'].forEach(function(id2, index2){
        if(needSinksSet) {
          links[key]['sinks'][index2] = nodes[id2];
        }
      });

      needSinksSet = false;
    });
  }

  return newLinkIds;
}

function initEdges(data) {
  edgesData = data['Edge'] || [];
  let newEdgeIds = [];
  for (let key in edgesData) {
    edges[key] = edgesData[key];
    edgeIds.push(key);
    newEdgeIds.push(key);

    let needEndsSet = true;

    edges[key]['start_vertices'].forEach(function(id1, index1){
      edges[key]['start_vertices'][index1] = vertices[id1];

      edges[key]['end_vertices'].forEach(function(id2, index2){
        if(needEndsSet) {
          edges[key]['end_vertices'][index2] = vertices[id2];
        }

        pairs[pairKey(id1, id2)]['edge'] = edges[key];
      });

      needEndsSet = false;
    });

    edges[key]['link'] = links[edgesData[key]['link']];
  }

  return newEdgeIds;
}

function initGraphs(data) {
  graphsData = data['Graph'] || [];
  let newGraphIds = [];
  for (let key in graphsData) {
    let newGraph = new Graph(graphsData[key]);
    graphs[key] = newGraph;
    graphIds.push(key);
    newGraphIds.push(key);

    // for (let index in graphsData[key]['nodes']) {
    //   graphs[key]['nodes'][index] = nodes[graphsData[key]['nodes'][index]];
    // }

    // for (let index in graphsData[key]['links']) {
    //   graphs[key]['links'][index] = links[graphsData[key]['links'][index]];
    // }
  }

  return newGraphIds;
}

function initWebs(data) {
  websData = data['Web'] || [];
  let newWebIds = [];
  for (let key in websData) {
    let newWeb = new Web(websData[key]);
    webs[key] = newWeb;
    webIds.push(key);
    newWebIds.push(key);

    // newWeb.graph.value = graphs[webs[key]['graph']];

    // for (let index in websData[key]['vertices']) {
    //   webs[key]['vertices'][index] = vertices[websData[key]['vertices'][index]];
    // }

    // for (let index in websData[key]['edges']) {
    //   webs[key]['edges'][index] = edges[websData[key]['edges'][index]];
    // }
  }

  return newWebIds;
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

  width = totalWidth - 15;
  height = totalHeight - 150;

  svg.attr('width', width).attr('height', height);
  svg.select('#background')
    .attr('width', width)
    .attr('height', height);

  paneSplitBorder.attr('height', height).attr('x', paneSplitPercent * width - 1);
  dataPane.select('foreignObject')
    .attr('width', width * (1 - paneSplitPercent))
    .attr('height', height);

  adjustFieldClip();
  adjustDataClip();
  draw();
}

function dragPaneSplit() {
  let x = d3.event.x,
      y = d3.event.y;

  paneSplitPercent = x / width;
  paneSplitBorder.attr('x', paneSplitPercent * width - 1);

  adjustFieldClip();
  adjustDataClip();
  draw();
}

function adjustFieldClip() {
  fieldClip.select('rect')
    .attr('x', -fX - (width * paneSplitPercent) / fS / 2)
    .attr('y', -fY - height / fS / 2)
    .attr('width', width * paneSplitPercent / fS - 1)
    .attr('height', height / fS);
}

function adjustDataClip() {
  dataClip.select('rect')
    // .attr('x', -fX - width / fS / 2)
    // .attr('y', -fY - height / fS / 2)
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width * (1 - paneSplitPercent) - 1)
    .attr('height', height);
}

function drawSync() {
  let vData = fieldPane.selectAll('.vertex').data(vertexIds, function(d){ return d; });
  let vEnterGroup = vData.enter().append('g')
    .attr('class', 'vertex')
    .attr('id', function(d){ return d; });
  vEnterGroup.append('circle')
    .attr('stroke', 'black');
  vEnterGroup.append('text')  // text: white outline
    .text(function(d){ return vertices[d]['data']['shortname']})
    .attr('x', function(d){ return vertices[d]['screen']['x']; })
    .attr('y', function(d){ return vertices[d]['screen']['y']; })
    .attr('class', 'outer')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .style('fill', 'white')
    .style('stroke', 'black');
  vEnterGroup.append('text')  // text: black core
    .text(function(d){ return vertices[d]['data']['shortname']})
    .attr('x', function(d){ return vertices[d]['screen']['x']; })
    .attr('y', function(d){ return vertices[d]['screen']['y']; })
    .attr('class', 'inner')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .style('fill', 'white')
    .style('stroke', 'white');

  vData.exit().remove();

  let eData = fieldPane.selectAll('.edge').data(edgeIds, function(d){ return d; });
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
  let vData = fieldPane.selectAll('.vertex').data(vertexIds, function(d){ return d; });
  vData.selectAll('circle')
    .attr('cx', function(d){ return vertices[d]['screen']['x']; })
    .attr('cy', function(d){ return vertices[d]['screen']['y']; })
    .attr('r', function(d){ return Math.sqrt(parseFloat(vertices[d]['node']['data'].value['size'])) * 2 / fS; })
    .attr('stroke-width', (2 / fS) + 'px')
    .attr('fill', function(d){ return vertices[d]['screen']['color'] || 'gray'; });
  vData.selectAll('text')
    .attr('x', function(d){ return vertices[d]['screen']['x']; })
    .attr('y', function(d){ return vertices[d]['screen']['y']; })
    .attr('font-size', 16 / fS );
  vData.selectAll('text.outer')
    .style('stroke-width', 5 / fS);
  vData.selectAll('text.inner')
    .style('stroke-width', 1 / fS);

  let eData = fieldPane.selectAll('.edge').data(edgeIds, function(d){ return d; });
  eData.selectAll('line')
    .attr('x1', function(d){ return edges[d]['start_vertices'][0]['screen']['x']; })
    .attr('y1', function(d){ return edges[d]['start_vertices'][0]['screen']['y']; })
    .attr('x2', function(d){ return edges[d]['end_vertices'][0]['screen']['x']; })
    .attr('y2', function(d){ return edges[d]['end_vertices'][0]['screen']['y']; })
    .attr('stroke-width', function(d){ return (2 / fS) + 'px'; });

  fieldPane.attr('transform', 'translate(' + (fX * fS + (width * paneSplitPercent) / 2) + ', ' + (fY * fS + height / 2) + ') scale(' + (fS) + ')');
  dataPane.attr('transform', 'translate(' + (dX * dS + width * paneSplitPercent) + ', ' + (dY * dS) + ') scale(' + (dS) + ')');
}

function populateDataPane(element) {
  console.log('populateDataPane', element);
  dataPaneContent.selectAll('*').remove();

  if (element != null) {
    dataPaneContent.append('p').html('Vertex: ' + element['id']);
    dataPaneContent.append('p').html('<strong>screen</strong>');
    dataPaneContent.append('textarea')
      .attr('id', 'vertex-screen')
      .html(JSON.stringify(element['screen']));
  }

  dataPaneContent.selectAll('*').on('focusout', applyDataChanges)
}

function applyDataChanges() {
  console.log('applyDataChanges');
  element = selected[0]['element'];
  let newValue = JSON.parse(dataPaneContent.select('#vertex-screen').property('value'));
  console.log('newValue:', newValue);
  element['screen'] = newValue;
  console.log('applyDataChanges', element);
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
  updateMouseEventData();
  changed = updateMouseState() || changed;
  changed = respondToScrollInput() || changed;
  changed = executeContinuousTriggers() || changed;

  if (doPhysics) {
    stepPhysics();
    changed = changed || true;
  }

  if (changed) {
    adjustFieldClip();
    draw();
  }
}

function saveWebname() {
  let inputName = $('#webname').val();
  console.log(inputName);
  web = webs[webIds[0]];
  if (inputName != web['name']) {
    web['name'] = inputName;

    $.ajax('/updatedata', {
      method: 'PUT',
      data: {'data': JSON.stringify([{
        '$model': 'web',
        '$id': web['id'],
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

var cumulativeAccel = {};
var twiddle = 0.1;
var stepSize = 0.1;
var initDrag = 1;

function stepPhysics() {
  let logger = [false, false];

  for (let vid in vertices) {
    cumulativeAccel[vid] = origingravity(vid);
  }

  for (let pairId in pairs) {
    let pair = pairs[pairId];
    let vids = pairId.split('_');
    let offset;

    if(pair['edge']) {
      offset = displace(vids[0], vids[1], pair['edge']);
    } else {
      offset = antigravity(vids[0], vids[1]);
    }

    cumulativeAccel[vids[0]][0] += offset[0];
    cumulativeAccel[vids[0]][1] += offset[1];
    cumulativeAccel[vids[1]][0] += offset[2];
    cumulativeAccel[vids[1]][1] += offset[3];
  }

  drag = initDrag / Math.pow((Date.now() - startTime) / 500000 + 1, 1./4);
  for (let vid in vertices) {
    vertices[vid]['screen']['xv'] = drag * (vertices[vid]['screen']['xv'] + stepSize * cumulativeAccel[vid][0]);
    vertices[vid]['screen']['yv'] = drag * (vertices[vid]['screen']['yv'] + stepSize * cumulativeAccel[vid][1]);

    vertices[vid]['screen']['x'] += stepSize * vertices[vid]['screen']['xv'];
    vertices[vid]['screen']['y'] += stepSize * vertices[vid]['screen']['yv'];
  }
}

var maxForceStrength = 2;
var minForceStrength = -maxForceStrength;
var minDist = 2;

function displace(v1id, v2id, link) {
  let closenessMultiplier = 1;
  let strengthMultiplier = 1.5;
  let v1x = vertices[v1id]['screen']['x'],
      v1y = vertices[v1id]['screen']['y'],
      v2x = vertices[v2id]['screen']['x'],
      v2y = vertices[v2id]['screen']['y'];

  let dist = Math.sqrt(Math.pow(v1x - v2x, 2) + Math.pow(v1y - v2y, 2));
  dist = Math.max(dist, minDist);

  let diff = link['closeness'] * closenessMultiplier - dist;
  let force = diff * link['strength'] * strengthMultiplier * twiddle;

  force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

  let off1x = force * (v1x - v2x) / dist,
    off1y = force * (v1y - v2y) / dist,
    off2x = force * (v2x - v1x) / dist,
    off2y = force * (v2y - v1y) / dist;

  return [off1x, off1y, off2x, off2y];
}

function antigravity(v1id, v2id) {
  let closenessMultiplier = 1;
  let strengthMultiplier = 1;
  let v1x = vertices[v1id]['screen']['x'],
      v1y = vertices[v1id]['screen']['y'],
      v2x = vertices[v2id]['screen']['x'],
      v2y = vertices[v2id]['screen']['y'];

  let dist = Math.sqrt(Math.pow(v1x - v2x, 2) + Math.pow(v1y - v2y, 2));
  dist = Math.max(dist, minDist);
  // let diff = link['closeness'] * closenessMultiplier - dist;
  // let force = diff * link['strength'] * strengthMultiplier;
  let force = 10 * twiddle / Math.pow(dist + 100, 1/2);

  force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

  let off1x = force * (v1x - v2x) / dist,
    off1y = force * (v1y - v2y) / dist,
    off2x = force * (v2x - v1x) / dist,
    off2y = force * (v2y - v1y) / dist;

  return [off1x, off1y, off2x, off2y];
}

function origingravity(vid) {
  let vertx = vertices[vid]['screen']['x'],
      verty = vertices[vid]['screen']['y'];
  let dist = Math.sqrt(vertx * vertx + verty * verty);
  dist = Math.max(dist, minDist);

  let force = -1./20 * twiddle * Math.pow(dist + 100, 1./1);

  force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

  let offx = force * vertx / dist;
      offy = force * verty / dist;

  return [offx, offy];
}

function dis(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}


var now = Date.now();
var mouseEvents = [[[null, null]], [], [], [], []]; // mousemove, left button, middle button, right button, scroll wheel
var mouseEventTimes = [now, now, now, now, now];
var mouseEventsTemp = [[[null, null]], [], [], [], []]; // helps avoid race conditions
var mouseEventTimesTemp = [now, now, now, now, now];
var mouseState = {"state": "hover", "scrollTime": 0, "changed": false, "scrolled": false};

function handleMouseDown() {
  if (whichPane(d3.event)[0] == 'field') {
    d3.event.preventDefault();
  }
  mouseState['changed'] = true;

  mouseEventsTemp[d3.event.which].unshift([d3.event, null]);
  mouseEventsTemp[0].unshift([d3.event, null]);
  mouseEventTimesTemp[d3.event.which] = Date.now();
}

function handleMouseUp() {
  if (whichPane(d3.event)[0] == 'field') {
    d3.event.preventDefault();
  }
  mouseState['changed'] = true;

  mouseEventsTemp[d3.event.which][0][1] = d3.event;
  mouseEventsTemp[0].unshift([d3.event, null]);
  mouseEventTimesTemp[d3.event.which] = Date.now();
}

function handleMouseMove() {
  if (whichPane(d3.event)[0] == 'field') {
    d3.event.preventDefault();
  }
  mouseState['changed'] = true;

  mouseEventsTemp[0][0][1] = d3.event;
  mouseEventTimesTemp[0] = Date.now();
}

function handleMouseScroll() {
  if (whichPane(d3.event)[0] == 'field') {
    d3.event.preventDefault();
  }
  mouseState['changed'] = true;
  mouseState['scrolled'] = true;

  mouseEventsTemp[4].unshift(d3.event);
  mouseEventTimesTemp[4] = Date.now();
}

function updateMouseEventData() {
  if (mouseState['changed'] == false) {
    return;
  }

  for (let i = 0; i < 5; i++) {
    mouseEventTimes[i] = mouseEventTimesTemp[i];

    let diff = mouseEventsTemp[i].length - mouseEvents[i].length;
    if (diff == 0) {
      continue;
    }

    // orig 0 1 2
    // temp 0 1 2 3 4
    // orig[0] = temp[2], orig.unshift(temp[1]), orig.unshift(temp[0])

    if (mouseEvents[i].length > 0) {
      mouseEvents[i][0] = mouseEventsTemp[diff];
    }

    for (let j = diff - 1; j > -1; j--) {
      mouseEvents[i].unshift(mouseEventsTemp[i][j]);
    }
  }
}

var moveDis = 10;
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
    // console.log("Mouse state: ", mouseState["state"]);

    if(mouseState["state"] == "click") {
      console.log("Clicks: ", mouseState["clicks"]);
    }
  }

  let changed = mouseState['changed'];
  mouseState['changed'] = false;
  return changed;
}

function respondToScrollInput() {
  let changed = false;
  if (!mouseState['scrolled']) {
    return false;
  }

  mouseState['scrolled'] = false;

  let [pane, x, y] = normalizeMousePosition(mouseEvents[4][0]);
  if (pane != 'field') {
    return false;
  }

  if(mouseState["scroll"][1] < 0) {
    fS = fieldPaneScale * 1.2;
    changed = true;
  } else if (mouseState["scroll"][1] > 0) {
    fS = fieldPaneScale / 1.2;
    changed = true;
  } else {
    fS = fieldPaneScale;
  }
  fieldPaneScale = fS;

  return changed;
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

function pan() {
  if(mouseState["buttons"] == 1 && whichPane(mouseEvents[0][0][0])[0] == 'field') {
      fX = (mouseEvents[0][0][1].x - mouseEvents[0][0][0].x) / fS + fieldPaneX;
      fY = (mouseEvents[0][0][1].y - mouseEvents[0][0][0].y) / fS + fieldPaneY;
      adjustFieldClip();
    }
}

function panEnd() {
  if (whichPane(mouseEvents[0][0][0])[0] == 'field') {
    fieldPaneX = fX;
    fieldPaneY = fY;
  }
}

function whichPane(event) {
  let boundingRect = document.getElementById('display').getBoundingClientRect();
  let realX = event.x - boundingRect.x;
  let realY = event.y - boundingRect.y;
  let pane = null;

  if (realX < width * paneSplitPercent) {
    pane = 'field';
  } else {
    pane = 'data';
  }

  return [pane, realX, realY];
}

function normalizeMousePosition(event) {
  console.log('normalizeMousePosition');

  let [pane, realX, realY] = whichPane(event);
  let x, y;

  if (pane == 'field') {
    x = (realX - width * paneSplitPercent / 2) / fS - fieldPaneX;
    y = (realY - height / 2) / fS - fieldPaneY;
  } else if (pane == 'data') {
    x = (realX - width * paneSplitPercent) / dS - dataPaneX;
    y = (realY - height) / dS - dataPaneY;
  }

  return [pane, x, y];
}

function identifyTargets(x, y, max_dist, types) {
  let targets = [[null, Infinity]];
  max_dist = max_dist || function(){ return Infinity; };
  types = types || [];

  if (types.indexOf('vertices') > -1) {
    for (let vid in vertices) {
      let vert = vertices[vid];
      let vx = vert['screen']['x'];
      let vy = vert['screen']['y'];
      let dist = Math.sqrt((vx - x)**2 + (vy - y)**2);

      if (dist < max_dist(vert)) {
        targets.push([vert, dist]);
      }
    }
  }

  targets.sort(function(a, b){ return a[1] - b[1]; })
  return targets
}

function generateTempId() {
  return "TEMP" + Math.random().toString().slice(2);
}

function createNode() {
  let [pane, x, y] = normalizeMousePosition(mouseEvents[1][0][0]);
  if (pane != 'field') {
    return;
  }

  let tempNodeId = generateTempId();
  let tempNode = {'subgraphs': [], 'data': {'size': 10}};
  nodeIds.push(tempNodeId);
  nodes[tempNodeId] = tempNode;

  let tempVertexId = generateTempId();
  let tempVertex = {'screen': {'x': x, 'y': y, 'xv': 0, 'yv': 0}, 'node': tempNode, 'data': {}};
  vertexIds.push(tempVertexId);
  vertices[tempVertexId] = tempVertex;

  graphs[graphIds[0]]['nodes'].push(tempNode);
  webs[webIds[0]]['vertices'].push(tempVertex);

  drawSync();

  $.ajax('/updatedata', {
    method: 'PUT',
    data: {'data': JSON.stringify([
      {
        '$model': 'node',
        '$id': tempNodeId,
        '$create': [{
          '$action': 'overwrite',
          '$type': 'dict',
          '$key': 'data',
          '$value': tempNode['data'],
        }],
      },
      {
        '$model': 'vertex',
        '$id': tempVertexId,
        '$create': [
          {
            '$action': 'overwrite',
            '$type': 'dict',
            '$key': 'screen',
            '$value': tempVertex['screen'],
          },
          {
            '$action': 'overwrite',
            '$type': 'model',
            '$key': 'node',
            '$value': {'$model': 'node', '$id': tempNodeId},
          },
        ],
      },
      {
        '$model': 'graph',
        '$id': graphIds[0],
        '$update': [{
          '$action': 'append',
          '$type': 'model',
          '$key': 'nodes',
          '$value': {'$model': 'node', '$id': tempNodeId},
        }],
      },
      {
        '$model': 'web',
        '$id': webIds[0],
        '$update': [{
          '$action': 'append',
          '$type': 'model',
          '$key': 'vertices',
          '$value': {'$model': 'vertex', '$id': tempVertexId},
        }],
      },
    ])},
    success: function(responseData) {
      console.log('SUCCESS ', responseData);
      let parsed;

      // Fix temporary node id
      parsed = JSON.parse(responseData['return_data'][0]);
      initNodes(parsed);
      delete nodes[tempNodeId];
      nodeIds.splice(nodeIds.indexOf(tempNodeId), 1);

      // Fix temporary vertex id
      parsed = JSON.parse(responseData['return_data'][1]);
      let newVertexIds = initVertices(parsed);
      delete vertices[tempVertexId];
      vertexIds.splice(vertexIds.indexOf(tempVertexId), 1);
      fieldPane.select('#' + tempVertexId).attr('id', newVertexIds[0]);

      graphs[graphIds[0]]['nodes'].splice(graphs[graphIds[0]]['nodes'].indexOf(tempNodeId), 1);
      webs[webIds[0]]['vertices'].splice(webs[webIds[0]]['vertices'].indexOf(tempVertexId), 1);

      drawSync();
    },
    error: function(responseData) {
      console.log('ERROR ', responseData);
    },
  });
}

function highlightClosestVertex() {
  let [pane, x, y] = normalizeMousePosition(mouseEvents[0][0][0]);
  if (pane == 'data') {
    return;
  }

  let max_dist = function(vert){
    return vert['node']['data']['size'] / fS;
  };

  let targets = identifyTargets(x, y, max_dist, ['vertices']);

  // deselect any currently selected vertices
  let i = 0;
  while (i < selected.length) {
    if (selected[i]['type'] == 'vertex') {
      selected[i]['element']['screen']['color'] = 'gray';
      selected.splice(i, 1);
    } else {
      i += 1;
    }
  }

  if (targets.length > 1) {
    targets[0][0]['screen']['color'] = 'white';
    selected.push({'type': 'vertex', 'element': targets[0][0]});
  }

  populateDataPane(targets[0][0]);
  draw();
}

function multiClick() {
  let targets = identifyTargets();

  if (mouseState['clicks'] == 1) {
    highlightClosestVertex();
  } else if (mouseState['clicks'] == 2) {
    createNode();
  }
}

continuousTriggers = [
  [/drag/, [pan]],
]

changeTriggers = [
  [/drag->hover/, [panEnd]],
  [/(click-)?down->click/, [multiClick]],
]
