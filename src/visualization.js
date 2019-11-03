import * as d3 from 'd3';
import Bezier from 'bezier-js';
import config from './config';
import clamp from 'lodash/clamp';

import './styles.styl';

const width = 2000;
const height = 2000;

const refsArray = [];

export default function draw() {
  const canvas = d3.select('.chart')
    .append('canvas')
    .attr('id', 'canvas')
    .attr('width', width)
    .attr('height', height)
    .node();

  const button = d3.select('.plus-button');

  const context = canvas.getContext('2d');

  function addCurve(startingPoint) {
    const currentPoints = [
      [
        startingPoint[0],
        startingPoint[1] + config.defaultRefLineYOffset
      ],
      [
        startingPoint[0] + config.defaultCurveWidth / 2,
        startingPoint[1] + config.defaultRefLineYOffset
      ],
      [
        startingPoint[0] + config.defaultCurveWidth / 2,
        startingPoint[1] + config.defaultCurveHeight + config.defaultRefLineYOffset
      ],
      [
        startingPoint[0] + config.defaultCurveWidth,
        startingPoint[1] + config.defaultCurveHeight + config.defaultRefLineYOffset
      ]
    ];

    currentPoints.topOffset = startingPoint[1];

    refsArray.push(currentPoints);

    button
      .style('top', `${ currentPoints[3][1] + 20 }px`);

    button
      .on('click', addNewCurve);
  }

  addCurve(config.canvasStartingPoint);

  function addNewCurve() {
    const last = refsArray[refsArray.length - 1];

    addCurve([
      config.canvasStartingPoint[0],
      last[3][1] + config.refsDistance
    ]);

    update();
  }

  function update() {
    refsArray.forEach((points, index) => {
      const curve = new Bezier(points.flat());

      if (!index) {
        context.clearRect(0, 0, width, height);
      }

      drawSkeleton(context, curve, index);
    });
  }

  d3.select(context.canvas)
    .call(drag, {radius: 20, refsArray: refsArray, update})
    .call(update)
    .node();

  function drag(selection, {refsArray, radius, update}) {
    function dragsubject() {
      let S = null;
      let R = radius;
      let isLeftHandler = false;
      let isRightHandler = false;
      let isTuner = false;
      let setIndex = null;

      refsArray.forEach((points, index) => {
        for (const p of points) {
          let r = Math.hypot(d3.event.x - p[0], d3.event.y - p[1]);
          if (r < R) {
            R = r;
            S = p;

            isLeftHandler = points.indexOf(p) === 0;
            isRightHandler = points.indexOf(p) === 3;
            isTuner = points.indexOf(p) === 1 || points.indexOf(p) === 2;
            setIndex = index;
          }
        }
      });

      return {x: S[0], y: S[1], point: S, isLeftHandler, isRightHandler, isTuner, setIndex};
    }

    function dragged() {
      const { isLeftHandler, isRightHandler, isTuner, setIndex } = d3.event.subject;
      const maxTop = refsArray[setIndex][3][1];

      if (!isLeftHandler && !isRightHandler) {
        refsArray[setIndex][1][0] = clamp(d3.event.x, refsArray[setIndex][0][0], refsArray[setIndex][3][0]);
        refsArray[setIndex][2][0] = clamp(d3.event.x, refsArray[setIndex][0][0], refsArray[setIndex][3][0]);
      }

      if (!isTuner) {
        let yCoord = null;

        if (isLeftHandler) {
          yCoord = clamp(d3.event.y, refsArray[setIndex].topOffset, refsArray[setIndex][3][1]);
          refsArray[setIndex][1][1] = yCoord;
        }

        if (isRightHandler) {
          yCoord = clamp(d3.event.y, refsArray[setIndex][0][1], Infinity);
          refsArray[setIndex][2][1] = yCoord;

          refsArray[setIndex][3][0] = clamp(d3.event.x, refsArray[setIndex][2][0], width);
        }

        d3.event.subject.point[1] = yCoord;
      }

      if (isRightHandler && setIndex !== refsArray.length - 1) {
        for (let i = setIndex + 1; i < refsArray.length; i++) {
          for (let j = 0; j < refsArray[i].length; j++) {
            refsArray[i][j][1] += d3.event.subject.point[1] - maxTop;
          }

          refsArray[i].topOffset = refsArray[i - 1][3][1] + config.refsDistance;
        }
      }

      if (isRightHandler) {
        button.style('top', `${ refsArray[refsArray.length - 1][3][1] + 30 }px`);
      }
    }

    selection.call(d3.drag()
      .subject(dragsubject)
      .on("drag", dragged)
      .on("start.update drag.update end.update", update));
  }

  function drawLine(ctx, p1, p2, options) {
    ctx.strokeStyle = options.color || config.defaultLineColor;
    ctx.lineWidth = options.width || config.defaultLineWidth;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  function drawCircle(ctx, p, r) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 2*Math.PI);
    ctx.stroke();
  }

  function drawPoints(ctx, points, options) {
    ctx.strokeStyle = options.color || config.defaultLineColor;
    points.forEach(p => drawCircle(ctx, p, 6));
  }

  function drawSkeleton(ctx, curve, index) {
    var pts = curve.points;
    
    // horizontal line
    const horizontalLineStartCoords = {
      x: pts[0].x,
      y: refsArray[index].topOffset
    };

    const horizontalLineEndCoords = {
      x: width,
      y: refsArray[index].topOffset
    };

    const horizontalLineConfig = {
      width: config.refHorizontalLineWidth,
      color: config.refHorizontalLineColor
    };

    drawLine(ctx, horizontalLineStartCoords, horizontalLineEndCoords, horizontalLineConfig);

    // left handler line
    drawLine(ctx, pts[0], pts[1], {color: 'lightgrey'});

    // right handler line
    drawLine(ctx, pts[2], pts[3], {color: 'lightgrey'});

    // handler circles
    drawPoints(ctx, pts, {color: 'black'});
    
    // left connect line
    const leftConnectLineStartCoords = horizontalLineStartCoords;
    const leftConnectLineEndCoords = pts[0];

    const connectLineConfig = {
      color: config.connectLineColor,
      width: config.connectLineWidth,
    };

    drawLine(ctx, leftConnectLineStartCoords, leftConnectLineEndCoords, connectLineConfig);
    
    // right connect line
    const rightConnectLineStartCoords = {
      x: pts[3].x,
      y: horizontalLineStartCoords.y
    };

    const rightConnectLineEndCoords = pts[3];

    drawLine(ctx, rightConnectLineStartCoords, rightConnectLineEndCoords, connectLineConfig);

    // horizontal connect line
    const horizontalConnectLineStartCoords = pts[3];
    const horizontalConnectLineEndCoords = {
      x: width,
      y: pts[3].y
    };

    drawLine(ctx, horizontalConnectLineStartCoords, horizontalConnectLineEndCoords, connectLineConfig);
    
    // curve
    drawCurve(context, curve);
  }

  function drawCurve(ctx, curve, offset) {
    ctx.lineWidth = config.refLineWidth;
    ctx.strokeStyle = config.refLineColor;

    offset = offset || { x:0, y:0 };
    var ox = offset.x;
    var oy = offset.y;
    ctx.beginPath();
    var p = curve.points, i;
    ctx.moveTo(p[0].x + ox, p[0].y + oy);
    if (p.length === 3) {
      ctx.quadraticCurveTo(
        p[1].x + ox, p[1].y + oy,
        p[2].x + ox, p[2].y + oy
      );
    }
    if (p.length === 4) {
      ctx.bezierCurveTo(
        p[1].x + ox, p[1].y + oy,
        p[2].x + ox, p[2].y + oy,
        p[3].x + ox, p[3].y + oy
      );
    }
    ctx.stroke();
    ctx.closePath();
    ctx.lineWidth = config.defaultLineWidth;
  }
}
