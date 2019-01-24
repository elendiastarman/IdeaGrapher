'use strict;';
/* global d3:false */

// The following come from models-and-fields.js:
/* global Node:false, Vertex:false, Link:false, Edge:false, Graph:false, Web:false, Rule:false, Document:false */
/* global models:false crossReference:false */

var svg = d3.select('#display');

var panes = {
  'dividers': [
    {
      'orientation': 'vertical',
      'percentage': 0.75,
      'border': null,
    },
    {
      'orientation': 'horizontal',
      'percentage': 0.5,
      'border': null,
    },
  ],
  'frames': [
    {
      'bounds': [null, 0, null, null],  // top right bottom left
      'position': {'x': 0, 'y': 0},
      'dimensions': {'width': 0, 'height': 0},
      'frame': null,
      'contents': 'viz',
      'clippath': null,
      'switcher': null,
    },
    {
      'bounds': [null, null, 1, 0],
      'position': {'x': 0, 'y': 0},
      'dimensions': {'width': 0, 'height': 0},
      'frame': null,
      'contents': 'selected',
      'clippath': null,
      'switcher': null,
    },
    {
      'bounds': [1, null, null, 0],
      'position': {'x': 0, 'y': 0},
      'dimensions': {'width': 0, 'height': 0},
      'frame': null,
      'contents': 'rules',
      'clippath': null,
      'switcher': null,
    },
  ],
  'contents': {
    'viz': {
      'shortname': 'Visual',
      'name': 'viz',
      'container': null,
      'inner': null,
      'reposition': function(container, x, y, width, height){
        container.select('#vizInner').attr('transform', 'translate(' + (width / 2) + ', ' + (height / 2) + ')');
      },
    },
    'selected': {
      'shortname': 'Selected',
      'name': 'selected',
      'container': null,
      'inner': null,
      'reposition': function(container, x, y, width, height){
        container.select('foreignObject')
          .attr('x', x + 5)
          .attr('y', y + 5)
          .attr('width', width - 10)
          .attr('height', height - 10);
      },
    },
    'rules': {
      'shortname': 'Rules',
      'name': 'rules',
      'container': null,
      'inner': null,
      'reposition': function(container, x, y, width, height){
        container.select('foreignObject')
          .attr('x', x + 5)
          .attr('y', y + 20)
          .attr('width', width - 10)
          .attr('height', height - 25);
      },
    },
  }
};

// For things like dragging or panning where it's useful to record the initial mouse position
var temp = {};

// Explicitly global variables
var width, height,  // of the whole SVG
    pairs = {},  // makes it easy to look up whether two vertices are connected or not
    selected = [],  // things that are currently selected
    currentWebs = [];  // stack of webs currently in

$(document).ready(function(){ init(); });

var startTime, loopTimer; // noqa
function init() {
  startTime = Date.now();

  loadData();

  let rootWeb = models['Document'].index(0)['webs'].value[0];
  currentWebs.push({'web': rootWeb, 'parent': null, 'scale': 1});

  svg.style('border', '1px solid black');
  svg.append('rect')
    .attr('id', 'background')
    .attr('fill', 'red');

  let defs = svg.append('defs');
  defs.append('g').attr('id', 'clippaths');
  defs.append('g').attr('id', 'webs');
  defs.append('symbol').attr('id', 'linePointer')
    .append('polygon')
      .attr('points', '0,0 7,0 0,20')
      .attr('stroke', 'black');

  initDividers();
  initFrames();
  initPanes();

  resizeSVG();
  populateSelectedPane();
  drawSync();

  panes['contents']['viz']['inner'].append('use')
    .attr('xlink:href', '#web' + rootWeb.id);
  models['Document'].index(0).rules.addInput(panes['contents']['rules']['inner'], true);

  while (enterOrExitSubweb(-1));
  draw();

  $('#docname').on('focusout', saveDocname);
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

  let delay = 20;
  loopTimer = setInterval(step, delay);
}

function initDividers() {
  for (let index in panes['dividers']) {
    let border = svg.append('rect')
      .attr('id', 'paneDivider' + index)
      .style('fill', 'black')
      .call(d3.drag().on('drag', dragDivider));

    if (panes['dividers'][index]['orientation'] == 'vertical') {
      border.attr('y', 0).attr('width', 5);
    } else if (panes['dividers'][index]['orientation'] == 'horizontal') {
      border.attr('x', 0).attr('height', 5);
    }

    panes['dividers'][index]['border'] = border;
  }
}

function initFrames() {
  for (let index in panes['frames']) {
    let frame = svg.append('g')
      .attr('id', 'frame' + index);
    frame.append('rect')
      .style('fill', 'white');

    let clippath = svg.select('#clippaths').append('clipPath')
      .attr('id', 'clippath' + index)
      .append('rect');

    let switcher = frame.append('foreignObject')
      .attr('width', 100)
      .attr('height', 20);
    switcher.append('xhtml:div')
      .attr('id', 'switcher' + index)
      .attr('xmlns', 'http://www.w3.org/1999/xhtml')
      .style('overflow', 'visible')
      .style('width', '100%')
      .style('height', '100%')
      .append('select')
        .on('change', function(){ console.log('switcher', this); });

    panes['frames'][index]['frame'] = frame;
    panes['frames'][index]['clippath'] = clippath;
    panes['frames'][index]['switcher'] = switcher;
  }
}

function initPanes() {
  let viz = panes['contents']['viz'];
  viz['container'] = svg.append('g')
    .attr('id', 'vizContainer');
  viz['inner'] = viz['container'].append('g')
    .attr('id', 'vizInner');

  let sel = panes['contents']['selected'];
  sel['container'] = svg.append('g')
    .attr('id', 'selectedContainer');
  sel['container'].append('foreignObject');
  sel['inner'] = sel['container'].select('foreignObject').append('xhtml:div')
    .attr('id', 'selectedInner')
    .attr('xmlns', 'http://www.w3.org/1999/xhtml')
    .style('overflow', 'auto')
    .style('width', '100%')
    .style('height', '100%');

  let rul = panes['contents']['rules'];
  rul['container'] = svg.append('g')
    .attr('id', 'rulesContainer');
  rul['container'].append('foreignObject');
  rul['inner'] = rul['container'].select('foreignObject').append('xhtml:div')
    .attr('id', 'rulesInner')
    .attr('xmlns', 'http://www.w3.org/1999/xhtml')
    .style('overflow', 'auto')
    .style('width', '100%')
    .style('height', '100%');
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
    models['Node'].add(new Node(nodesData[key]));
  }
}

function initVertices(data) {
  let verticesData = data['Vertex'] || [];
  for (let key in verticesData) {
    models['Vertex'].add(new Vertex(verticesData[key]));
  }

  models['Vertex'].modelIds.forEach(function(v1id) {
    models['Vertex'].modelIds.forEach(function(v2id) {
      if(v1id != v2id) {
        pairs[pairKey(v1id, v2id)] = {vertex1: models['Vertex'][v1id], vertex2: models['Vertex'][v2id], edge: null};
      }
    });
  });
}

function initLinks(data) {
  let linksData = data['Link'] || [];
  for (let key in linksData) {
    models['Link'].add(new Link(linksData[key]));
  }
}

function initEdges(data) {
  let edgesData = data['Edge'] || [];
  for (let key in edgesData) {
    models['Edge'].add(new Edge(edgesData[key]));
  }
}

function initGraphs(data) {
  let graphsData = data['Graph'] || [];
  for (let key in graphsData) {
    models['Graph'].add(new Graph(graphsData[key]));
  }
}

function initWebs(data) {
  let websData = data['Web'] || [];
  for (let key in websData) {
    models['Web'].add(new Web(websData[key]));
  }
}

function initRules(data) {
  let rulesData = data['Rule'] || [];
  for (let key in rulesData) {
    models['Rule'].add(new Rule(rulesData[key]));
  }
}

function initDocuments(data) {
  let documentsData = data['Document'] || [];
  for (let key in documentsData) {
    models['Document'].add(new Document(documentsData[key]));
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
  initRules(data);
  initDocuments(data);
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

  for (let index in panes['dividers']) {
    let div = panes['dividers'][index];
    if (div['orientation'] == 'vertical') {
      div['border']
        .attr('height', height)
        .attr('x', div['percentage'] * width - 2);
    } else if (div['orientation'] == 'horizontal') {
      div['border']
        .attr('width', width)
        .attr('y', div['percentage'] * height - 2);
    }
  }

  adjustPanes();
}

function dragDivider() {
  let x = Math.max(Math.min(d3.event.x, width - 100), 100),
      y = Math.max(Math.min(d3.event.y, height - 100), 100);
  
  let index = Number(/(\d+)/.exec(d3.select(this).attr('id'))[0]);
  let div = panes['dividers'][index];

  if (div['orientation'] == 'vertical') {
    let newPercent = x / width;
    div['percentage'] = newPercent;
    div['border'].attr('x', newPercent * width - 2);
  } else if (div['orientation'] == 'horizontal') {
    let newPercent = y / height;
    div['percentage'] = newPercent;
    div['border'].attr('y', newPercent * height - 2);
  }

  adjustPanes();
}

function adjustPanes() {
  let taken = [];
  for (let frame of panes['frames']) {
    taken.push(panes['frames']['contents']);
  }

  for (let index in panes['frames']) {
    let frame = panes['frames'][index];
    let top = frame['bounds'][0] == null ? 0 : panes['dividers'][ frame['bounds'][0] ]['percentage'] * height + 2,
        right = frame['bounds'][1] == null ? width : panes['dividers'][ frame['bounds'][1] ]['percentage'] * width - 2,
        bottom = frame['bounds'][2] == null ? height : panes['dividers'][ frame['bounds'][2] ]['percentage'] * height - 2,
        left = frame['bounds'][3] == null ? 0 : panes['dividers'][ frame['bounds'][3] ]['percentage'] * width + 2;

    frame['position'] = {'x': left, 'y': top};
    frame['dimensions'] = {'width': right - left, 'height': bottom - top};

    frame['frame'].select('rect')
      .attr('x', left)
      .attr('y', top)
      .attr('width', right - left)
      .attr('height', bottom - top);
    frame['clippath']
      .attr('x', left)
      .attr('y', top)
      .attr('width', right - left)
      .attr('height', bottom - top);

    frame['switcher'].attr('x', left).attr('y', top);

    let selector = frame['switcher'].select('select');
    selector.selectAll('option').remove();
    for (let key in panes['contents']) {
      // console.log('key:', key);
      let option = selector.append('option')
        .attr('value', key)
        .html(panes['contents'][key]['shortname']);

      if (key == frame['contents']) {
        option.property('selected', true);
      } else if (taken.indexOf(key) > -1) {
        option.property('disabled', true);
      }
    }

    if (frame['contents']) {
      let contents = panes['contents'][frame['contents']];
      contents['reposition'](contents['container'], left, top, right - left, bottom - top);
      contents['container'].attr('clip-path', 'url(#clippath' + index + ')');
    }
  }
}

function drawSync() {
  let websDef = svg.select('#webs');

  let wData = websDef.selectAll('.web').data(models['Web'].modelIds, function(d){ return d; });
  let wEnterGroup = wData.enter().append('g')
    .attr('class', 'web')
    .attr('id', function(d){ return 'web' + d; });
  wEnterGroup.append('g').attr('class', 'highlights');
  wEnterGroup.append('g').attr('class', 'edges');
  wEnterGroup.append('g').attr('class', 'vertices');

  let webId, vData, vEnterGroup, eData, eEnterGroup, subwebContainers;

  for (let web of models['Web']) {
    webId = web.id;

    vData = websDef.select('[id=\'web' + webId + '\']').select('.vertices').selectAll('.vertex').data(web['vertices'].serialize(), function(d){ return d; });
    vEnterGroup = vData.enter().append('g')
      .attr('class', 'vertex')
      .attr('id', function(d){ return d; });
    vEnterGroup.append('circle')
      .attr('class', 'highlight')
      .attr('fill', 'yellow')
      .style('visibility', 'hidden');
    vEnterGroup.append('circle')
      .attr('class', 'circle')
      .attr('stroke', 'black');
    vEnterGroup.append('text')  // text: white outline
      .attr('class', 'outer')
      .style('font-family', 'Courier')
      .style('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'central')
      .style('fill', 'white')
      .style('stroke', 'black');
    vEnterGroup.append('text')  // text: black core
      .attr('class', 'inner')
      .style('font-family', 'Courier')
      .style('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'central')
      .style('fill', 'white')
      .style('stroke', 'white');

    subwebContainers = vEnterGroup.append('g')
      .attr('class', 'subwebContainer')
      .style('visibility', 'hidden');
    subwebContainers.append('circle')
      .attr('class', 'backing')
      .style('fill', 'white');
    subwebContainers.append('g')
      .attr('class', 'subweb');

    vData.exit().remove();

    eData = websDef.select('[id=\'web' + webId + '\']').selectAll('.edges').selectAll('.edge').data(web['edges'].serialize(), function(d){ return d; });
    eEnterGroup = eData.enter().append('g')
      .attr('class', 'edge')
      .attr('id', function(d){ return d; });
    eEnterGroup.append('line')
      .attr('class', 'highlight')
      .attr('stroke', 'yellow')
      .style('visibility', 'hidden');
    eEnterGroup.append('line')
      .attr('class', 'line');
    eEnterGroup.append('use')
      .attr('xlink:href', '#linePointer')
      .style('visibility', 'hidden');

    eData.exit().remove();
  }

  for (let vertex of models['Vertex']) {
    if (vertex.subwebs.value.length > 0) {
      d3.select('[id=\'' + vertex.id + '\']').select('.subweb').selectAll('use').data(vertex.subwebs.serialize())
        .enter().append('use')
          .attr('xlink:href', function(d){ return '#web' + d; });
    }
  }

  draw();
}

function draw() {
  let vScale = 1;

  for (let index in currentWebs) {
    let web = currentWebs[index]['web'];
    vScale *= web['screen']['scale'];

    d3.select('#web' + web.id)
      .attr('transform', function(d){
        let screen = models['Web'][d]['screen'];
        return 'translate(' + screen['x'] * screen['scale'] + ',' + screen['y'] * screen['scale'] + ') scale(' + screen['scale'] + ')';
      });

    let vData = d3.select('#web' + web.id).select('.vertices').selectAll('.vertex').data(web['vertices'].serialize(), function(d){ return d; });
    vData
      .attr('transform', function(d){ return 'translate(' + models['Vertex'][d]['screen']['x'] + ',' + models['Vertex'][d]['screen']['y'] + ')'; });
    vData.select('circle.highlight')
      .attr('r', function(d){ return Math.sqrt(parseFloat(models['Vertex'][d]['node']['data']['size'])) + 4 / vScale; });
    vData.select('circle.circle')
      .attr('r', function(d){ return Math.sqrt(parseFloat(models['Vertex'][d]['node']['data']['size'])); })
      .attr('stroke-width', (2 / vScale) + 'px')
      .attr('fill', function(d){ return models['Vertex'][d]['screen']['color'] || 'gray'; });
    vData.selectAll('text')
      .text(function(d){ return models['Vertex'][d]['data']['shortname']; })
      .attr('font-size', 16 / vScale );
    vData.select('text.outer')
      .style('stroke-width', 4 / vScale);
    vData.select('text.inner')
      .style('stroke-width', 0.25 / vScale);

    vData.select('.subwebContainer').select('circle')
      .attr('r', function(d){ return 0.9 * Math.sqrt(parseFloat(models['Vertex'][d]['node']['data']['size'])); });

    let eData = d3.select('#web' + web.id).select('.edges').selectAll('.edge').data(web['edges'].serialize(), function(d){ return d; });
    eData.selectAll('line.highlight')
      .attr('x1', function(d){ return models['Edge'][d]['start_vertices'].value[0]['screen']['x']; })
      .attr('y1', function(d){ return models['Edge'][d]['start_vertices'].value[0]['screen']['y']; })
      .attr('x2', function(d){ return models['Edge'][d]['end_vertices'].value[0]['screen']['x']; })
      .attr('y2', function(d){ return models['Edge'][d]['end_vertices'].value[0]['screen']['y']; })
      .attr('stroke-width', function(d){ return ((models['Edge'][d]['screen']['thickness'] + 4) / vScale) + 'px'; });
    eData.selectAll('line.line')
      .attr('x1', function(d){ return models['Edge'][d]['start_vertices'].value[0]['screen']['x']; })
      .attr('y1', function(d){ return models['Edge'][d]['start_vertices'].value[0]['screen']['y']; })
      .attr('x2', function(d){ return models['Edge'][d]['end_vertices'].value[0]['screen']['x']; })
      .attr('y2', function(d){ return models['Edge'][d]['end_vertices'].value[0]['screen']['y']; })
      .attr('stroke-width', function(d){ return (models['Edge'][d]['screen']['thickness'] / vScale) + 'px'; })
      .attr('stroke', function(d){ return models['Edge'][d]['screen']['color']; });
    eData.selectAll('use')
      .attr('transform', function(d){
        let sv = models['Edge'][d]['start_vertices'].value[0],
            ev = models['Edge'][d]['end_vertices'].value[0];
        let svx = sv['screen']['x'],
            svy = sv['screen']['y'],
            evx = ev['screen']['x'],
            evy = ev['screen']['y'];
        let newX = svx + (evx - svx) * 0.55,
            newY = svy + (evy - svy) * 0.55;
        let rot = Math.atan2(evy - svy, evx - svx);
        return 'translate(' + newX + ' ' + newY + ') scale(' + 1 / vScale + ') rotate(' + (rot * 180 / Math.PI - 90) + ') translate(' + (models['Edge'][d]['screen']['thickness'] / 2) + ' 0)';
      })
      .style('visibility', function(d){ return models['Edge'][d]['kind'].value == 'directed' ? 'inherit' : 'hidden'; })
      .style('fill', function(d){ return models['Edge'][d]['screen']['color']; });
  }
}

function addToSelected(element, deselectAll) {
  if (deselectAll != false) {
    selected = [];
    d3.selectAll('.highlight')
      .style('visibility', 'hidden');
  }
  if (element != null) {
    selected.push(element);
  }
  
  if (element instanceof Vertex || element instanceof Edge) {
    d3.select('[id=\'' + element.id + '\']').select('.highlight')
      .style('visibility', 'inherit');
  }
}

function populateSelectedPane(element) {
  let inner = panes['contents']['selected']['inner'];
  inner.selectAll('*').remove();

  if (element != null) {
    element._populateContainer(inner);
  } else {
    currentWebs[currentWebs.length - 1]['web']._populateContainer(inner);
  }
}

function step() {
  let changed = false;
  changed = updateMouseState() || changed;
  changed = respondToScrollInput() || changed;
  changed = executeContinuousTriggers() || changed;

  for (let rule of models['Rule']) {
    if (rule.active.value) {
      let runRule = false;

      if (rule.trigger.value == 'tick') {
        runRule = true;
      } else if (rule.trigger.value == 'change' && changed) {
        runRule = true;
      }

      if (runRule) {
        rule._applyRule();
      }
    }

    if (rule.trigger.value == 'periodic') {
      if (rule.active.value && rule._interval == null && rule.frequency.value) {
        rule._interval = setInterval((function(r){ return function(){ r._applyRule(); }; })(rule), rule.frequency.value);
      } else if (!rule.active.value && rule._interval != null) {
        clearInterval(rule._interval);
        rule._interval = null;
      }
    } else {
      if (rule._interval != null) {
        clearInterval(rule._interval);
        rule._interval = null;
      }
    }
  }

  if (changed) {
    draw();
  }
}

function saveDocname() {
  let inputName = $('#docname').val();
  let doc = models['Document'].index(0);
  if (inputName != doc['name'].value) {
    doc['name'].value = inputName;

    $.ajax('/updatedata', {
      method: 'PUT',
      data: {'data': JSON.stringify([{
        '$model': 'document',
        '$id': doc.id,
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

var now = Date.now();
var mouseEvents = [[[null, null]], [], [], [], []]; // mousemove, left button, middle button, right button, scroll wheel
var mouseEventTimes = [now, now, now, now, now];
var mouseState = {
  'state': 'hover',
  'scrollTime': 0,
  'changed': false,
  'scrolled': false,
  'lastPressed': null,
  'lastReleased': null,
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
  let oldState = mouseState['state'];

  // hover -> down
  if(mouseState['state'] == 'hover') {

    // down -> down
    if(buttonsDown > 0) {
      mouseState['state'] = 'down';
    }

  }

  // down -> click, hold, drag
  else if (mouseState['state'] == 'down') {

    // up -> click
    if(buttonsDown == 0) {
      mouseState['state'] = 'click';
      mouseState['clicks'] = 1;
    }

    // wait -> hold
    else if (now - mouseState['time'] > holdTime) {
      mouseState['state'] = 'hold';
    }

    // move -> drag
    else if (mouseEvents[0][0][1] != null) {
      let a = mouseEvents[0][0][0],
          b = mouseEvents[0][0][1];

      if(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) > Math.pow(moveDis, 2)) {
        mouseState['state'] = 'drag';
      }
    }
  }

  // click -> hover, click-down
  else if (mouseState['state'] == 'click') {

    // down -> click-down
    if(buttonsDown > 0) {
      mouseState['state'] = 'click-down';
    }

    // wait -> hover
    else if (now - mouseState['time'] > clickWaitTime) {
      mouseState['state'] = 'hover';
    }
  }

  // click-down -> click, click-drag, click-hold
  else if (mouseState['state'] == 'click-down') {

    // up -> click
    if(buttonsDown == 0) {
      mouseState['state'] = 'click';
      mouseState['clicks'] += 1;
    }

    // wait -> click-hold
    else if (now - mouseState['time'] > holdTime) {
      mouseState['state'] = 'click-hold';
    }

    // move -> click-drag
    else if (mouseEvents[0][0][1] != null) {
      let a = mouseEvents[0][0][0],
          b = mouseEvents[0][0][1];

      if(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) > Math.pow(moveDis, 2)) {
        mouseState['state'] = 'click-drag';
      }
    }
  }

  // click-drag, click-hold, hold, hold-drag, drag, drag-hold + up -> hover
  else if (buttonsDown == 0 && ['click-drag', 'click-hold', 'hold', 'hold-drag', 'drag', 'drag-hold'].includes(mouseState['state'])) {
    mouseState['state'] = 'hover';
    mouseState['clicks'] = 0;
  }

  // hold -> hold-drag
  else if (mouseState['state'] == 'hold') {

    // move -> hold-drag
    if(mouseEvents[0][0][1] != null) {
      let a = mouseEvents[0][0][0],
          b = mouseEvents[0][0][1];

      if(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) > Math.pow(moveDis, 2)) {
        mouseState['state'] = 'hold-drag';
      }
    }
  }

  // drag -> drag-hold

  // known states and nothing to do
  else if (['click', 'click-drag', 'click-hold', 'hold', 'hold-drag', 'drag', 'drag-hold'].includes(mouseState['state'])) {
    // pass
  }

  // unknown state
  else {
    console.log('ERROR! Unknown/invalid state: ' + mouseState['state']);
  }

  if(mouseEvents[4].length && mouseEventTimes[4] > mouseState['scrollTime']) {
    mouseState['scroll'] = [mouseEvents[4][0].deltaX, mouseEvents[4][0].deltaY];
    mouseState['scrollTime'] = mouseEventTimes[4];
  } else {
    mouseState['scroll'] = [0, 0];
  }

  mouseState['buttons'] = buttonsDown;

  if(mouseState['state'] != oldState) {
    mouseState['time'] = now;
    executeChangeTriggers(oldState, mouseState['state']);
  }

  let changed = mouseState['changed'];
  mouseState['changed'] = false;
  return changed;
}

function respondToScrollInput() {
  if (!mouseState['scrolled'] || mouseState['scroll'][1] == 0) {
    return false;
  }
  mouseState['scrolled'] = false;

  let [pane, frame, realX, realY, normX, normY] = whichPane(mouseEvents[4][0]);
  if (pane != 'viz') {
    return false;
  }

  let rootWeb = currentWebs[0]['web'];
  let mouseX = normX,
      mouseY = normY;

  mouseX = (normX - frame['dimensions']['width'] / 2) / rootWeb['screen']['scale'] - rootWeb['screen']['x'];
  mouseY = (normY - frame['dimensions']['height'] / 2) / rootWeb['screen']['scale'] - rootWeb['screen']['y'];

  let dispX, dispY, scaleFactor;

  if (mouseState['scroll'][1] < 0) {
    scaleFactor = 1.2;
  } else if (mouseState['scroll'][1] > 0) {
    scaleFactor = 1 / 1.2;
  }

  dispX = mouseX + rootWeb['screen']['x'];
  dispY = mouseY + rootWeb['screen']['y'];
  rootWeb['screen']['scale'] *= scaleFactor;
  rootWeb['screen']['x'] += dispX * (1 / scaleFactor - 1);
  rootWeb['screen']['y'] += dispY * (1 / scaleFactor - 1);

  enterOrExitSubweb(mouseState['scroll'][1]);

  return true;
}

function enterOrExitSubweb(scrollDirection) {
  let topWeb = currentWebs[currentWebs.length - 1];
  let rootWeb = currentWebs[0]['web'];

  let frame;
  for (let index in panes['frames']) {
    frame = panes['frames'][index];
    if (frame['contents'] == 'viz') {
      break;
    }
  }
  let frameWidth = frame['dimensions']['width'],
      frameHeight = frame['dimensions']['height'];

  console.log('topWeb:', topWeb);
  console.log('frame:', frame);

  if (scrollDirection < 0) {
    // zooming in; can enter subweb
    let chosenVertex = null;
    let chosenDist = Infinity;

    for (let index in topWeb['web'].vertices.value) {
      let vertex = topWeb['web'].vertices.value[index];
      let visualSize = rootWeb['screen']['scale'] * Math.sqrt(vertex['node']['data']['size']) * 2;
      let threshold = Math.min(width, height);
      let xDiff = Math.abs(vertex['screen']['x'] + rootWeb['screen']['x']) * rootWeb['screen']['scale'];
      let yDiff = Math.abs(vertex['screen']['y'] + rootWeb['screen']['y']) * rootWeb['screen']['scale'];

      if (visualSize > threshold && xDiff < frameWidth / 2 && yDiff < frameHeight / 2) {
        let distFromCenter = xDiff**2 + yDiff**2;
        if (chosenVertex == null || distFromCenter < chosenDist) {
          chosenVertex = vertex;
          chosenDist = distFromCenter;
        }
      }
    }

    if (chosenVertex == null || chosenVertex.subwebs.value.length == 0) {
      return false;
    }

    // console.log('chosenVertex:', chosenVertex);
    d3.select('[id=\'' + chosenVertex.id + '\']').select('.subwebContainer').style('visibility', 'visible');
    // console.log('subwebs:', chosenVertex.subwebs.value);
    currentWebs.push({'web': chosenVertex.subwebs.value[0], 'parent': chosenVertex, 'scale': 1});

    return true;

  } else if (scrollDirection > 0) {
    // zooming out; can exit subweb
    if (currentWebs.length <= 1) {
      return false;
    }

    if (rootWeb['screen']['scale'] * Math.sqrt(topWeb['parent']['node']['data']['size']) * 2 < Math.min(frameWidth, frameHeight)) {
      console.log('exiting subweb');
      d3.select('[id=\'' + topWeb['parent'].id + '\']').select('.subwebContainer').style('visibility', 'hidden');
      currentWebs.pop();
    }

    return true;
  }
}

var continuousTriggers;
function executeContinuousTriggers() {
  let changed = false;

  for(let index in continuousTriggers) {
    let group = continuousTriggers[index];
    if(group[0].exec(mouseState['state'])) {
      for(let fIndex in group[1]) {
        group[1][fIndex]();
        changed = true;
      }
    }
  }

  return changed;
}

var changeTriggers;
function executeChangeTriggers(oldState, newState) {
  let changed = false;

  for(let index in changeTriggers) {
    let group = changeTriggers[index];
    if(group[0].exec(oldState + '->' + newState)) {
      for(let fIndex in group[1]) {
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
  if(mouseState['buttons'] == 1 && whichPane(mouseEvents[0][0][0])[0] == 'viz') {
    if (temp['pan'] == null) {
      temp['pan'] = {
        'startX': currentWebs[0]['web']['screen']['x'],
        'startY': currentWebs[0]['web']['screen']['y'],
      };
    }

    currentWebs[0]['web']['screen']['x'] = (mouseEvents[0][0][1].x - mouseEvents[0][0][0].x) / currentWebs[0]['web']['screen']['scale'] + temp['pan']['startX'];
    currentWebs[0]['web']['screen']['y'] = (mouseEvents[0][0][1].y - mouseEvents[0][0][0].y) / currentWebs[0]['web']['screen']['scale'] + temp['pan']['startY'];
  }
}

function dragVertex(vertex) {
  if(mouseState['buttons'] == 1 && whichPane(mouseEvents[0][0][0])[0] == 'viz') {
    if (temp['dragVertex'] == null) {
      temp['dragVertex'] = {
        'startX': vertex['screen']['x'],
        'startY': vertex['screen']['y'],
        'vertex': vertex,
      };
    } else {
      vertex = temp['dragVertex']['vertex'];
    }

    let vScale = 1;
    for (let item of currentWebs) {
      vScale *= item['web']['screen']['scale'];
    }

    vertex['screen']['x'] = (mouseEvents[0][0][1].x - mouseEvents[0][0][0].x) / vScale + temp['dragVertex']['startX'];
    vertex['screen']['y'] = (mouseEvents[0][0][1].y - mouseEvents[0][0][0].y) / vScale + temp['dragVertex']['startY'];
  }
}

function whichPane(event) {
  let boundingRect = document.getElementById('display').getBoundingClientRect();
  let realX = event.x - boundingRect.x,
      realY = event.y - boundingRect.y,
      normX = realX,
      normY = realY;
  let pane = null, frame = null;

  for (let index in panes['frames']) {
    frame = panes['frames'][index];
    normX = realX - frame['position']['x'];
    normY = realY - frame['position']['y'];

    if (0 <= normX && normX <= frame['dimensions']['width'] && 0 <= normY && normY <= frame['dimensions']['height']) {
      pane = frame['contents'];
      break;
    }
  }

  return [pane, frame, realX, realY, normX, normY];
}

function normalizeMousePosition(event) {
  let [pane, frame, realX, realY, normX, normY] = whichPane(event);
  let rootWeb = currentWebs[0]['web'];
  let x = normX,
      y = normY;

  if (pane == 'viz') {
    x = (normX - frame['dimensions']['width'] / 2);
    y = (normY - frame['dimensions']['height'] / 2);

    for (let index in currentWebs) {
      let parent = currentWebs[index]['parent'];
      if (parent) {
        // console.log(currentWebs[index]['parent']);
        x -= parent['screen']['x'];
        y -= parent['screen']['y'];
      }

      let web = currentWebs[index]['web'];
      x = x / web['screen']['scale'] - web['screen']['x'];
      y = y / web['screen']['scale'] - web['screen']['y'];
    }
  }

  return [pane, x, y];
}

function identifyTargets(x, y, types) {
  let targets = [[null, Infinity]];
  types = types || [];
  let topWeb = currentWebs[currentWebs.length - 1]['web'];

  for (let index in types) {
    let [type, max_dist] = types[index];
    max_dist = max_dist || function(){ return Infinity; };

    if (type == 'vertices') {
      for (let index in topWeb['vertices'].value) {
        let vertex = topWeb['vertices'].value[index];
        let vx = vertex['screen']['x'];
        let vy = vertex['screen']['y'];
        let dist = Math.sqrt((vx - x)**2 + (vy - y)**2);

        if (dist < max_dist(vertex)) {
          targets.push([vertex, dist]);
        }
      }
    } else if (type == 'edges') {
      for (let index in topWeb['edges'].value) {
        let edge = topWeb['edges'].value[index];
        let x0 = x,
            y0 = y,
            x1 = edge['start_vertices'].value[0]['screen']['x'],
            y1 = edge['start_vertices'].value[0]['screen']['y'],
            x2 = edge['end_vertices'].value[0]['screen']['x'],
            y2 = edge['end_vertices'].value[0]['screen']['y'];

        let segmentLength = Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);
        let distFromVertex1 = Math.abs((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / segmentLength;
        let distFromVertex2 = Math.abs((x0 - x2) * (x1 - x2) + (y0 - y2) * (y1 - y2)) / segmentLength;
        // Eq. (14) here: http://mathworld.wolfram.com/Point-LineDistance2-Dimensional.html
        let perpendicularDist = Math.abs((x2 - x1) * (y1 - y0) - (x1 - x0) * (y2 - y1)) / segmentLength;

        // Slight misnomer
        let totalDist = perpendicularDist + (distFromVertex1 + distFromVertex2 - segmentLength);

        if (totalDist < max_dist(edge)) {
          targets.push([edge, totalDist]);
        }
      }
    }
  }

  targets.sort(function(a, b){ return a[1] - b[1]; });
  return targets;
}

function handleDoubleClick() {
  let [pane, x, y] = normalizeMousePosition(mouseEvents[1][0][0]);
  if (pane != 'viz') {
    return;
  }

  let vert_max_dist = function(vertex){
    return Math.sqrt(vertex['node']['data']['size']);
  };

  let targets = identifyTargets(x, y, [['vertices', vert_max_dist]]);

  if (targets.length <= 1) {
    createVertex(x, y);
  } else {
    let vertex = targets[0][0];
    zoomToVertex(vertex);
    if (vertex.subwebs.value.length == 0) {
      createSubweb(vertex);
    }
  }
}

function createVertex(x, y) {
  let newNode = new Node(Node._defaultData({'data': {'size': 100}}), false);
  let newVertex = new Vertex(Vertex._defaultData({'screen': {'x': x, 'y': y}, 'node': newNode.id, 'data': {'shortname': 'text'}}), false);
  models['Node'].add(newNode);
  models['Vertex'].add(newVertex);

  let topWeb = currentWebs[currentWebs.length - 1]['web'];
  topWeb.graph['nodes'].push(newNode.id);
  topWeb['vertices'].push(newVertex.id);

  crossReference[newNode.id]['Graph'] = [topWeb.graph.id];
  crossReference[newVertex.id]['Web'] = [topWeb.id];

  drawSync();
  addToSelected(newVertex);
  populateSelectedPane(newVertex);
}

function createSubweb(vertex) {
  let newGraph = new Graph(Graph._defaultData(), false);
  let newWeb = new Web(Web._defaultData({'graph': newGraph.id}), false);
  models['Graph'].add(newGraph);
  models['Web'].add(newWeb);

  vertex.node.subgraphs.push(newGraph.id);
  vertex.subwebs.push(newWeb.id);

  crossReference[newGraph.id]['Node'] = [vertex.node.id];
  crossReference[newWeb.id]['Vertex'] = [vertex.id];

  drawSync();
  addToSelected(newWeb);
  populateSelectedPane(newWeb);
}

function makeEdge(start_vertex, end_vertex) {
  let newLink = new Link(Link._defaultData({'sources': [start_vertex['node'].value.id], 'sinks': [end_vertex['node'].value.id]}), false);
  let newEdge = new Edge(Edge._defaultData({'start_vertices': [start_vertex.id], 'end_vertices': [end_vertex.id], 'link': newLink.id}), false);
  models['Link'].add(newLink);
  models['Edge'].add(newEdge);

  let topWeb = currentWebs[currentWebs.length - 1]['web'];
  topWeb.graph['links'].push(newLink.id);
  topWeb['edges'].push(newEdge.id);

  crossReference[newLink.id]['Graph'] = [topWeb.graph.id];
  crossReference[newEdge.id]['Web'] = [topWeb.id];

  drawSync();
  addToSelected(newEdge);
  populateSelectedPane(newEdge);
}

function zoomToVertex(vertex) {
  console.log('zooming');
  let rootWeb = currentWebs[0]['web'];

  let frame;
  for (let index in panes['frames']) {
    frame = panes['frames'][index];
    if (frame['contents'] == 'viz') {
      break;
    }
  }
  let frameWidth = frame['dimensions']['width'],
      frameHeight = frame['dimensions']['height'];

  if (temp['zooming'] == undefined) {

    let now = new Date();
    temp['zooming'] = {
      'startTime': now,
      'duration': 400,  // milliseconds
      'startX': rootWeb['screen']['x'],
      'startY': rootWeb['screen']['y'],
      'startS': rootWeb['screen']['scale'],
      'endX': -vertex['screen']['x'],
      'endY': -vertex['screen']['y'],
      'endS': Math.max(frameWidth, frameHeight) * 0.95 / Math.sqrt(vertex['node']['data']['size']) / 2,
      'timer': setInterval(zoomToVertex, 10),
    };

  } else {

    let tween = (new Date() - temp['zooming']['startTime']) / temp['zooming']['duration'];
    let done = tween > 1;
    tween = Math.min(tween, 1);

    rootWeb['screen']['x'] = temp['zooming']['startX'] + tween**0.2 * (temp['zooming']['endX'] - temp['zooming']['startX']);
    rootWeb['screen']['y'] = temp['zooming']['startY'] + tween**0.2 * (temp['zooming']['endY'] - temp['zooming']['startY']);
    rootWeb['screen']['scale'] = temp['zooming']['startS'] + tween**8 * (temp['zooming']['endS'] - temp['zooming']['startS']);

    draw();

    if (done) {
      clearInterval(temp['zooming']['timer']);
      delete temp['zooming'];
      enterOrExitSubweb(-1);
    }

  }
}

function selectClosestElement() {
  let [pane, x, y] = normalizeMousePosition(mouseEvents[0][0][0]);
  console.log('mouse:', x, y);
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
    addToSelected(null);
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

    if (end && end.id != temp['makingEdge']['start'].id) {
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
      addToSelected(start);
    }

  } else if (mouseState['lastReleased'] == 1) {

    // Given a choice between a vertex and an edge, pick the vertex.
    let closestVertex = null;
    let closestEdge = null;

    for (let index in targets) {
      if (targets[index][0] instanceof Vertex) {
        closestVertex = targets[index][0];
        break;
      } else if (targets[index][0] instanceof Edge && closestEdge == null) {
        closestEdge = targets[index][0];
      }
    }

    let closestElement = closestVertex || closestEdge;
    addToSelected(closestElement);
    populateSelectedPane(closestElement);
  }
}

function multiClick() {
  if (mouseState['clicks'] == 1) {
    selectClosestElement();
  } else if (mouseState['clicks'] == 2) {
    handleDoubleClick();
  }
}

continuousTriggers = [
  [/drag/, [drag]],
];

changeTriggers = [
  [/drag->hover/, [dragEnd]],
  [/(click-)?down->click/, [multiClick]],
];
