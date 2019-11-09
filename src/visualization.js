import * as d3 from 'd3';
import Bezier from 'bezier-js';
import config from './config';
import clamp from 'lodash/clamp';

import './styles.styl';

const width = 2000;
const height = 2000;

const refsArray = [];
let mainCurvePoints = [];

const pointerCircleCoords = {
  x: -100,
  y: -100
};

const targetPoints = [];

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

  const mainCurveStartingPoint = [
    config.canvasStartingPoint[0],
    refsArray[refsArray.length - 1][3][1] + config.dividerOffset * 2
  ];

  mainCurvePoints = [
    [
      mainCurveStartingPoint[0],
      mainCurveStartingPoint[1] + config.defaultRefLineYOffset
    ],
    [
      mainCurveStartingPoint[0] + config.defaultCurveWidth,
      mainCurveStartingPoint[1] + config.defaultRefLineYOffset
    ],
    [
      mainCurveStartingPoint[0] + config.defaultCurveWidth,
      mainCurveStartingPoint[1] + config.defaultCurveHeight + config.defaultRefLineYOffset
    ],
    [
      mainCurveStartingPoint[0] + config.defaultCurveWidth * 2,
      mainCurveStartingPoint[1] + config.defaultCurveHeight + config.defaultRefLineYOffset
    ]
  ];

  function addNewCurve() {
    const last = refsArray[refsArray.length - 1];

    addCurve([
      config.canvasStartingPoint[0],
      last[3][1] + config.refsDistance
    ]);

    update();
  }

  function update() {
    context.clearRect(0, 0, width, height);

    refsArray.forEach((points, index) => {
      const curve = new Bezier(points.flat());

      drawSkeleton(context, curve, refsArray[index]);
    });

    // divider
    const dividerStartCoords = {
      x: config.canvasStartingPoint[0],
      y: refsArray[refsArray.length - 1][3][1] + config.dividerOffset
    };

    const dividerEndCoords = {
      x: width,
      y: refsArray[refsArray.length - 1][3][1] + config.dividerOffset
    };

    drawLine(context, dividerStartCoords, dividerEndCoords, {
      color: config.dividerLineColor, width: config.dividerLineWidth
    });

    // mainCurve
    const mainCurve = new Bezier(mainCurvePoints.flat());
    drawSkeleton(context, mainCurve, mainCurvePoints, true);

    // pointer circle
    drawCircle(
      context,
      pointerCircleCoords,
      4,
      {
        width: config.circleWidth,
        color: config.circleColor
      }
    );

    if (targetPoints.length) {
      targetPoints.forEach((x) => {
        const options = {
          cubicBezier: {
            xs:[
              mainCurvePoints[0][0],
              mainCurvePoints[1][0],
              mainCurvePoints[2][0],
              mainCurvePoints[3][0]
            ],
            ys:[
              mainCurvePoints[0][1],
              mainCurvePoints[1][1],
              mainCurvePoints[2][1],
              mainCurvePoints[3][1]
            ]
          },
          x
        };

        const y = getValOnCubicBezier_givenXorX(options);

        if (!y) { return false; }

        drawCircle(
          context,
          {
            x,
            y
          },
          3,
          {
            width: config.targetPointWidth,
            color: config.targetPointColor
          }
        );
      });
    }
  }

  d3.select(context.canvas)
    .call(drag, {radius: 20, refsArray: refsArray, update})
    .call(update)
    .node();

  const throttledMouseMove = function handleMouseMove(){
    var xy = d3.mouse(this);

    var color = context.getImageData(xy[0], xy[1], 1, 1).data;

    if (color[2] > 135 && color[2] < 145) {
      if (pointerCircleCoords.x !== xy[0] && pointerCircleCoords.y !== xy[1]) {
        pointerCircleCoords.x = xy[0];
        pointerCircleCoords.y = xy[1];
        update();
      }
    } else if (pointerCircleCoords.x !== -100) {
      pointerCircleCoords.x = -100;
      pointerCircleCoords.y = -100;
      update();
    }
  };

  d3.select(context.canvas)
    .on('mousemove', throttledMouseMove)
    .on('click', handleClick);

  function handleClick() {
    var xy = d3.mouse(this);

    if (pointerCircleCoords.x > 0) {
      targetPoints[0] = xy[0];

      update();
    }
  }

  function drag(selection, {refsArray, radius, update}) {
    function dragsubject() {
      let S = null;
      let R = radius;
      let isLeftHandler = false;
      let isRightHandler = false;
      let isTuner = false;
      let setIndex = null;
      let isMainCurve

      refsArray.concat([mainCurvePoints]).forEach((points, index) => {
        for (const p of points) {
          let r = Math.hypot(d3.event.x - p[0], d3.event.y - p[1]);
          if (r < R) {
            R = r;
            S = p;

            isMainCurve = mainCurvePoints === points;
            isLeftHandler = points.indexOf(p) === 0;
            isRightHandler = points.indexOf(p) === 3;
            isTuner = points.indexOf(p) === 1 || points.indexOf(p) === 2;
            setIndex = index;
          }
        }
      });

      if (!S) return false;

      return {
        x: S[0],
        y: S[1],
        point: S,
        isLeftHandler,
        isRightHandler,
        isTuner,
        setIndex,
        isMainCurve
      };
    }

    function dragged() {
      const {
        isLeftHandler,
        isRightHandler,
        isMainCurve,
        isTuner,
        setIndex,
      } = d3.event.subject;

      const array = isMainCurve ? mainCurvePoints : refsArray[setIndex];

      if (!array) return false;

      const maxTop = array[3][1];

      if (!isLeftHandler && !isRightHandler) {
        array[1][0] = clamp(d3.event.x, array[0][0], array[3][0]);
        array[2][0] = clamp(d3.event.x, array[0][0], array[3][0]);
      }

      if (!isTuner) {
        let yCoord = null;

        if (isLeftHandler) {
          yCoord = clamp(d3.event.y, array.topOffset, array[3][1]);
          array[1][1] = yCoord;
        }

        if (isRightHandler) {
          yCoord = clamp(d3.event.y, array[0][1], Infinity);
          array[2][1] = yCoord;

          const leftEdge = targetPoints.length
            ? targetPoints[0] > array[2][0] ? targetPoints[0] : array[2][0]
            : array[2][0];

          array[3][0] = clamp(d3.event.x, leftEdge, width);
        }

        d3.event.subject.point[1] = yCoord;
      }

      if (!isMainCurve) {
        if (isRightHandler && setIndex !== refsArray.length - 1) {
          for (let i = setIndex + 1; i < refsArray.length; i++) {
            for (let j = 0; j < refsArray[i].length; j++) {
              refsArray[i][j][1] += d3.event.subject.point[1] - maxTop;
            }

            refsArray[i].topOffset = refsArray[i - 1][3][1] + config.refsDistance;
          }
        }

        if (isRightHandler) {
          for (let k = 0; k < mainCurvePoints.length; k++) {
            mainCurvePoints[k][1] += d3.event.subject.point[1] - maxTop;
          }

          button.style('top', `${ refsArray[refsArray.length - 1][3][1] + 30 }px`);
        }
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

  function drawCircle(ctx, p, r, options) {
    if (options) {
      ctx.lineWidth = options.width;
      ctx.strokeStyle = options.color;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 2*Math.PI);
    ctx.stroke();

    if (options) {
      ctx.lineWidth = config.defaultLineColor;
      ctx.strokeStyle = config.defaultLineWidth;
    }
  }

  function drawPoints(ctx, points, options) {
    ctx.strokeStyle = options.color || config.defaultLineColor;
    points.forEach(p => drawCircle(ctx, p, 6));
  }

  function drawSkeleton(ctx, curve, array, isMain) {
    var pts = curve.points;

    // horizontal line
    const horizontalLineStartCoords = {
      x: pts[0].x,
      y: array.topOffset
    };

    const horizontalLineEndCoords = {
      x: width,
      y: array.topOffset
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
    drawCurve(context, curve, isMain);
  }

  function drawCurve(ctx, curve, isMain) {
    ctx.lineWidth = config.refLineWidth * (isMain ? 2 : 1);
    ctx.strokeStyle = isMain ? config.mainLineColor : config.refLineColor;

    ctx.beginPath();
    var p = curve.points;
    ctx.moveTo(p[0].x, p[0].y);
    if (p.length === 3) {
      ctx.quadraticCurveTo(
        p[1].x, p[1].y,
        p[2].x, p[2].y
      );
    }
    if (p.length === 4) {
      ctx.bezierCurveTo(
        p[1].x, p[1].y,
        p[2].x, p[2].y,
        p[3].x, p[3].y
      );
    }
    ctx.stroke();
    ctx.closePath();
    ctx.lineWidth = config.defaultLineWidth;
  }
}

function getValOnCubicBezier_givenXorX(options) {
  /*
  options = {
   cubicBezier: {xs:[x1, x2, x3, x4], ys:[y1, y2, y3, y4]};
   x: NUMBER //this is the known x, if provide this must not provide y, a number for x will be returned
   y: NUMBER //this is the known y, if provide this must not provide x, a number for y will be returned
  }
  */
  if ('x' in options && 'y' in options) {
    throw new Error('cannot provide known x and known y');
  }
  if (!('x' in options) && !('y' in options)) {
    throw new Error('must provide EITHER a known x OR a known y');
  }

  var x1 = options.cubicBezier.xs[0];
  var x2 = options.cubicBezier.xs[1];
  var x3 = options.cubicBezier.xs[2];
  var x4 = options.cubicBezier.xs[3];

  var y1 = options.cubicBezier.ys[0];
  var y2 = options.cubicBezier.ys[1];
  var y3 = options.cubicBezier.ys[2];
  var y4 = options.cubicBezier.ys[3];

  var LUT = {
    x: [],
    y: []
  }

  for(var i=0; i<5000; i++) {
    var t = i/5000;
    LUT.x.push( (1-t)*(1-t)*(1-t)*x1 + 3*(1-t)*(1-t)*t*x2 + 3*(1-t)*t*t*x3 + t*t*t*x4 );
    LUT.y.push( (1-t)*(1-t)*(1-t)*y1 + 3*(1-t)*(1-t)*t*y2 + 3*(1-t)*t*t*y3 + t*t*t*y4 );
  }

  if ('x' in options) {
    var knw = 'x'; //known
    var unk = 'y'; //unknown
  } else {
    var knw = 'y'; //known
    var unk = 'x'; //unknown
  }

  for (var i=1; i<5000; i++) {
    if (options[knw] >= LUT[knw][i] && options[knw] <= LUT[knw][i+1]) {
      var linearInterpolationValue = options[knw] - LUT[knw][i];
      return LUT[unk][i] + linearInterpolationValue;
    }
  }
}