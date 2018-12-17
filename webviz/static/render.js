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
    webs = {},
    webIds = [],
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
  $('#webname').on('focusout', saveWebname);

  svg.on('mousedown', handleMouseDown);
  svg.on('mouseup', handleMouseUp);
  svg.on('mousemove', handleMouseMove);
  svg.on('wheel.zoom', handleMouseScroll);
  svg.on('contextmenu', function(){ d3.event.preventDefault(); });

  // start();
  let delay = 20;
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
  let data = JSON.parse($('#data > p').html());

  nodesData = data['Node'] || [];
  for (let key in nodesData) {
    nodes[key] = nodesData[key];
    nodeIds.push(key);
  }

  nodeIds.forEach(function(n1id) {
    nodeIds.forEach(function(n2id) {
      if(n1id != n2id) {
        pairs[pairKey(n1id, n2id)] = {node1: nodes[n1id], node2: nodes[n2id], linked: false};
      }
    });
  });

  linksData = data['Link'] || [];
  for (let key in linksData) {
    links[key] = linksData[key];
    linkIds.push(key);
    let sinksSet = false;

    item['sources'].forEach(function(e1, i1){
      let node = nodes[e1];
      if (node){
        item['sources'][i1] = node;
      }

      item['sinks'].forEach(function(e2, i2){
        if(!sinksSet) {
          let node = nodes[e2];
          if (node){
            item['sinks'][i2] = node;
          }
        }

        pairs[pairKey(e1, e2)]['linked'] = true;
        pairs[pairKey(e1, e2)]['link'] = item;
      });

      sinksSet = true;
    });
  }

  graphsData = data['Graph'] || [];
  for (let key in graphsData) {
    graphs[key] = graphsData[key];
    graphIds.push(key);
  }

  websData = data['Web'] || [];
  for (let key in websData) {
    webs[key] = websData[key];
    webIds.push(key);

    if (webs[key]['graph']) {
      webs[key]['graph'] = graphs[webs[key]['graph']];
    }
  }
}

function syncDataAndGraphics() {
  nodeIds.forEach(function(id) {
    vertices[id] = {
      'node': nodes[id],
      'x': Math.random() * 400 - 200,
      'y': Math.random() * 400 - 200,
      'xv': 0,
      'yv': 0,
      'color': 'gray',
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
  let eData = field.selectAll('.link').data(linkIds);
  let eGroup = eData.enter().append('g')
    .attr('class', 'link')
    .attr('id', function(d){ return d; });
  eGroup.append('line')
    .attr('stroke', 'black')
    .attr('stroke-wdith', '2px');

  eData.exit().remove();

  let vData = field.selectAll('.node').data(nodeIds);
  let vEnterGroup = vData.enter().append('g')
    .attr('class', 'node')
    .attr('id', function(d){ return d; });
  vEnterGroup.append('circle')
    .attr('stroke', 'black');
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
  let vData = field.selectAll('.node');
  vData.selectAll('circle')
    .attr('cx', function(d){ return vertices[d]['x']; })
    .attr('cy', function(d){ return vertices[d]['y']; })
    .attr('r', function(d){ return Math.sqrt(parseFloat(vertices[d]['node']['data']['size'] || 10)) * 2 / fS; })
    .attr('stroke-width', (2 / fS) + 'px')
    .attr('fill', function(d){ return vertices[d]['color']; });
  vData.selectAll('text')
    .attr('x', function(d){ return vertices[d]['x']; })
    .attr('y', function(d){ return vertices[d]['y']; })
    .attr('font-size', 16 / fS );
  vData.selectAll('text.outer')
    .style('stroke-width', 5 / fS);
  vData.selectAll('text.inner')
    .style('stroke-width', 1 / fS);

  let eData = field.selectAll('.link');
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
  let changed = false;
  updateMouseEventData();
  changed = updateMouseState() || changed;
  changed = respondToInput() || changed;

  changed = executeContinuousTriggers() || changed;

  if (doPhysics) {
    stepPhysics();
    changed = changed || true;
  }

  if (changed) {
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

  for(nid in nodes) {
    cumulativeAccel[nid] = origingravity(nid);
  }

  for(pairId in pairs) {
    let pair = pairs[pairId];
    let nids = pairId.split('_');
    let offset;

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
  let closenessMultiplier = 1;
  let strengthMultiplier = 1.5;
  let n1x = vertices[n1id]['x'],
      n1y = vertices[n1id]['y'],
      n2x = vertices[n2id]['x'],
      n2y = vertices[n2id]['y'];

  let dist = Math.sqrt(Math.pow(n1x - n2x, 2) + Math.pow(n1y - n2y, 2));
  dist = Math.max(dist, minDist);

  let diff = link['closeness'] * closenessMultiplier - dist;
  let force = diff * link['strength'] * strengthMultiplier * twiddle;

  force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

  let off1x = force * (n1x - n2x) / dist,
    off1y = force * (n1y - n2y) / dist,
    off2x = force * (n2x - n1x) / dist,
    off2y = force * (n2y - n1y) / dist;

  return [off1x, off1y, off2x, off2y];
}

function antigravity(n1id, n2id) {
  let closenessMultiplier = 1;
  let strengthMultiplier = 1;
  let n1x = vertices[n1id]['x'],
      n1y = vertices[n1id]['y'],
      n2x = vertices[n2id]['x'],
      n2y = vertices[n2id]['y'];

  let dist = Math.sqrt(Math.pow(n1x - n2x, 2) + Math.pow(n1y - n2y, 2));
  dist = Math.max(dist, minDist);
  // let diff = link['closeness'] * closenessMultiplier - dist;
  // let force = diff * link['strength'] * strengthMultiplier;
  let force = 10 * twiddle / Math.pow(dist + 100, 1/2);

  force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

  let off1x = force * (n1x - n2x) / dist,
    off1y = force * (n1y - n2y) / dist,
    off2x = force * (n2x - n1x) / dist,
    off2y = force * (n2y - n1y) / dist;

  return [off1x, off1y, off2x, off2y];
}

function origingravity(nid) {
  let nx = vertices[nid]['x'],
      ny = vertices[nid]['y'];
  let dist = Math.sqrt(nx*nx + ny*ny);
  dist = Math.max(dist, minDist);

  let force = -1./20 * twiddle * Math.pow(dist + 100, 1./1);

  force = Math.min(Math.max(force, minForceStrength), maxForceStrength);

  let offx = force * nx / dist;
      offy = force * ny / dist;

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
var mouseState = {"state": "hover", "scrollTime": 0, "changed": false};

function handleMouseDown() {
  d3.event.preventDefault();
  mouseState['changed'] = true;

  mouseEventsTemp[d3.event.which].unshift([d3.event, null]);
  mouseEventsTemp[0].unshift([d3.event, null]);
  mouseEventTimesTemp[d3.event.which] = Date.now();
}

function handleMouseUp() {
  d3.event.preventDefault();
  mouseState['changed'] = true;

  mouseEventsTemp[d3.event.which][0][1] = d3.event;
  mouseEventsTemp[0].unshift([d3.event, null]);
  mouseEventTimesTemp[d3.event.which] = Date.now();
}

function handleMouseMove() {
  d3.event.preventDefault();
  mouseState['changed'] = true;

  mouseEventsTemp[0][0][1] = d3.event;
  mouseEventTimesTemp[0] = Date.now();
}

function handleMouseScroll() {
  d3.event.preventDefault();
  mouseState['changed'] = true;

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

function respondToInput() {
  let changed = false;

  if(mouseState["scroll"][1] < 0) {
    fS = fieldScale * 1.2;
    changed = true;
  } else if (mouseState["scroll"][1] > 0) {
    fS = fieldScale / 1.2;
    changed = true;
  } else {
    fS = fieldScale;
  }
  fieldScale = fS;

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
  if(mouseState["buttons"] == 1) {
      fX = (mouseEvents[0][0][1].x - mouseEvents[0][0][0].x) / fS + fieldX;
      fY = (mouseEvents[0][0][1].y - mouseEvents[0][0][0].y) / fS + fieldY;
    }
}

function panEnd() {
  fieldX = fX;
  fieldY = fY;
}

function identifyTargets() {
}

function createNode() {
  let newNodeId = "<TEMP>" + Math.random().toString();
  let newNode = {'subgraphs': [], 'data': {'size': 10}};
  nodeIds.push(newNodeId);
  nodes[newNodeId] = newNode;

  syncDataAndGraphics();
  drawSync();

  $.ajax('/updatedata', {
    method: 'PUT',
    data: {'data': JSON.stringify([
      {
        '$model': 'node',
        '$id': newNodeId,
        '$create': {
          '$action': 'overwrite',
          '$type': 'dict',
          '$key': 'data',
          '$value': newNode['data'],
        },
      },
      {
        '$model': 'graph',
        '$id': graphIds[0],
        '$update': [{
          '$action': 'append',
          '$type': 'model',
          '$key': 'nodes',
          '$value': {'$model': 'node', '$id': newNodeId},
        }],
      },
    ])},
    success: function(responseData) {
      console.log('SUCCESS ', responseData);
      let parsed = JSON.parse(responseData['return_data'][0]);
      let realId = null;
      for (let key in parsed['Node']) {
        realId = realId || key;
      }
      nodes[realId] = newNode;
      delete nodes[newNodeId];
      nodeIds.pop()
      nodeIds.push(realId)

      syncDataAndGraphics();
      drawSync();
    },
    error: function(responseData) {
      console.log('ERROR ', responseData);
    },
  });
}

function normalizeMousePosition(event) {
  let boundingRect = document.getElementById('display').getBoundingClientRect();
  let x = (event.x - boundingRect.x - width / 2) / fS - fieldX;
  let y = (event.y - boundingRect.y - height / 2) / fS - fieldY;
  return [x, y];
}

function highlightClosestNode() {
  let [x, y] = normalizeMousePosition(mouseEvents[0][0][0]);
  let max_dist = 20 / fS;

  for (let i in nodeIds) {
    let id = nodeIds[i];
    let vx = vertices[id]['x'];
    let vy = vertices[id]['y'];

    let dist = Math.pow(vx - x, 2) + Math.pow(vy - y, 2);

    if (dist < Math.pow(max_dist, 2)) {
      vertices[id]['color'] = 'white';
    } else {
      vertices[id]['color'] = 'gray';
    }
  }
  draw();
}

function multiClick() {
  let targets = identifyTargets();

  if (mouseState['clicks'] == 1) {
    highlightClosestNode();
  } else if (mouseState['clicks'] == 2) {
    createNode();
  }
}

continuousTriggers = [
  [/drag/, [pan]],
]

changeTriggers = [
  [/drag->hover/, [panEnd]],
  [/click->hover/, [multiClick]],
]

