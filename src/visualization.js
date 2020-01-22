import * as d3 from 'd3';
import Bezier from 'bezier-js';
import config from './config';
import clamp from 'lodash/clamp';

import './styles.styl';

var path = document.createElementNS("http://www.w3.org/2000/svg","path");

const width = 4000;
const height = 4000;
const refsArray = [];
let mainCurvePoints = [];
let collectionsArray = [];
let targetLineCoords = null;
let resultsPoints = [];
const targetPoints = [];
let curves = [];
let inputIsFocused = false;
let prevValue = null;
let prevYValue = null;

const pointerCircleCoords = {
  x: -100,
  y: -100
};

const coordsInputsContainer = d3.select('.coords-inputs');
const coordsInputX = d3.select('.coords-input-x');
const coordsInputY = d3.select('.coords-input-y');

function swapItems(a, b) {
  const aCopy = a.map(i => i.map(j => j));
  aCopy.topOffset = a.topOffset;

  a.forEach((item, index) => {
    item[0] = b[index][0];
    item[1] = a.topOffset + (b[index][1] - b.topOffset);
  });

  b.topOffset = a[3][1] + config.refsDistance;

  b.forEach((item, index) => {
    item[0] = aCopy[index][0];
    item[1] = b.topOffset + (aCopy[index][1] - aCopy.topOffset);
  });
}

export default function draw() {
  const canvas = d3.select('.chart')
    .append('canvas')
    .attr('id', 'canvas')
    .attr('width', width)
    .attr('height', height)
    .node();

  const plusButton = d3.select('.plus-button');
  const minusButton = d3.select('.minus-button');
  const upButtonsContainer = document.querySelector('.up-buttons');
  const downButtonsContainer = document.querySelector('.down-buttons');
  const duplicateButtonsContainer = document.querySelector('.duplicate-buttons');
  const offsetInputsContainer = document.querySelector('.offset-inputs');
  const saveButton = d3.select('.save');

  const context = canvas.getContext('2d');

  saveButton.on('click', () => {
    const image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    window.location.href = image;
  });

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

    for (let k = 0; k < mainCurvePoints.length; k++) {
      mainCurvePoints[k][1] += currentPoints[3][1] - currentPoints[0][1] + config.refsDistance
        + config.defaultRefLineYOffset;
    }

    plusButton
      .style('top', `${ currentPoints[3][1] + 20 }px`);

    plusButton
      .on('click', addNewCurve);

    minusButton
      .style('top', `${ currentPoints[3][1] + 20 }px`);

    minusButton
      .on('click', removeLastCurve);
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

  window.addEventListener('keydown', function(event) {
    if (inputIsFocused) {
      return false;
    }

    event.preventDefault();

    if (event.keyCode === 32) { // space
      mainCurvePoints.push([
        mainCurvePoints[mainCurvePoints.length - 1][0] + 75,
        mainCurvePoints[mainCurvePoints.length - 1][1],
      ]);

      update();
    }

    if (event.keyCode === 8) { // backspace
      mainCurvePoints.pop();

      update();
    }
  });

  function addNewCurve() {
    const last = refsArray[refsArray.length - 1];

    addCurve([
      config.canvasStartingPoint[0],
      last[3][1] + config.refsDistance
    ]);

    update();
  }

  function removeLastCurve() {
    const removedCurvePoints = refsArray.pop();
    resultsPoints.pop();

    for (let k = 0; k < mainCurvePoints.length; k++) {
      mainCurvePoints[k][1] -= removedCurvePoints[3][1] - removedCurvePoints[0][1] + config.refsDistance
        + config.defaultRefLineYOffset;
    }

    plusButton
      .style('top', `${ refsArray[refsArray.length - 1][3][1] + 20 }px`);

    minusButton
      .style('top', `${ refsArray[refsArray.length - 1][3][1] + 20 }px`);

    d3.select(duplicateButtonsContainer.children[duplicateButtonsContainer.children.length - 1]).remove();
    d3.select(upButtonsContainer.children[duplicateButtonsContainer.children.length - 1]).remove();
    d3.select(downButtonsContainer.children[duplicateButtonsContainer.children.length - 1]).remove();
    d3.select(offsetInputsContainer.children[offsetInputsContainer.children.length - 1]).remove();

    update();
  }

  function update() {
    context.clearRect(0, 0, width, height);

    if (refsArray.length > 1) {
      minusButton.style('display', 'block');
    } else {
      minusButton.style('display', 'none');
    }

    curves.length = 0;

    refsArray.forEach((points, index) => {
      const curve = new Bezier(points.flat());
      curves.push(curve);

      let btnDown = d3.select(downButtonsContainer.children[index]);

      if (!btnDown.size()) {
        btnDown = d3.select(downButtonsContainer.appendChild(document.createElement('div')));
      }

      btnDown.on('click', () => {
        swapItems(refsArray[index], refsArray[index + 1]);

        update();
      });

      btnDown.style('display', 'block');
      btnDown.style('top', `${ points.topOffset }px`);

      if (index === refsArray.length - 1) {
        btnDown.style('display', 'none');
      }

      let btnUp = d3.select(upButtonsContainer.children[index]);

      if (!btnUp.size()) {
        btnUp = d3.select(upButtonsContainer.appendChild(document.createElement('div')));
      }

      btnUp.on('click', () => {
        swapItems(refsArray[index - 1], refsArray[index]);

        update();
      });

      btnUp.style('display', 'block');
      btnUp.style('top', `${ points.topOffset }px`);

      if (index === 0) {
        btnUp.style('display', 'none');
      }

      let btnDplc = d3.select(duplicateButtonsContainer.children[index]);

      if (!btnDplc.size()) {
        btnDplc = d3.select(duplicateButtonsContainer.appendChild(document.createElement('div')));
      }

      btnDplc.on('click', () => {
        const newItem = [[],[],[],[]];

        newItem.topOffset = refsArray[index][3][1] + config.refsDistance;

        refsArray[index].forEach((item, indx) => {
          newItem[indx][0] = item[0];
          newItem[indx][1] = newItem.topOffset + (item[1] - refsArray[index].topOffset);
        });

        const maxTop = newItem[3][1] - newItem.topOffset + config.refsDistance;

        for (let i = index + 1; i < refsArray.length; i++) {
          refsArray[i].forEach((item) => {
            item[1] = item[1] + maxTop;
          });

          refsArray[i].topOffset = refsArray[i].topOffset + maxTop;
        }

        mainCurvePoints.forEach(item => {
          item[1] = item[1] + maxTop;
        });

        refsArray.splice(index + 1, 0, newItem);

        update();
      });

      btnDplc.style('top', `${ points.topOffset }px`);

      let offsetInput = d3.select(offsetInputsContainer.children[index]);

      if (!offsetInput.size() && (!index || (index === 1 && (0 in targetPoints)) || (index > 1 && (index - 2 in resultsPoints)))) {
        const input = document.createElement('input');
        input.type = "text";
        offsetInput = d3.select(offsetInputsContainer.appendChild(input));

        offsetInput.on('focus', function() {
          inputIsFocused = true;
          prevValue = parseInt(this.value, 10);
        });

        offsetInput.on('blur', function() {
          inputIsFocused = false;

          const index = Array.prototype.indexOf.call(offsetInputsContainer.children, offsetInput.node());
          const value = parseInt(this.value, 10) + config.canvasStartingPoint[0];

          if (!index && (!value || value < config.canvasStartingPoint[0])) {
            this.focus();
            alert('Укажите неотрицательное значение');
            return false;
          }

          if (index && value < (resultsPoints[index - 2] || targetPoints[0])) {
            this.focus();
            alert(`Укажите значение от ${ (resultsPoints[index - 2] || targetPoints[0]) - 100 }`);
            return false;
          }

          if (prevValue) {
            const diff = value - config.canvasStartingPoint[0] - prevValue;

            for(let j = index + 1; j < offsetInputsContainer.children.length; j++) {
              const inputNode = d3.select(offsetInputsContainer.children[j]);
              const inputValue = parseInt(inputNode.property('value'), 10);
              inputNode.property('value', inputValue + diff);
              resultsPoints[j - 1] = inputValue + diff + config.canvasStartingPoint[0];
            }
          }

          if (index) {
            resultsPoints[index - 1] = value;
          } else {
            targetPoints[0] = value;
          }

          update();
        });
      }

      offsetInput.style('top', `${ points.topOffset + 30 }px`);

      plusButton
        .style('top', `${ refsArray[refsArray.length - 1][3][1] + 20 }px`);

      minusButton
        .style('top', `${ refsArray[refsArray.length - 1][3][1] + 20 }px`);

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

    pointerCircleCoords.text = [
      pointerCircleCoords.x - mainCurvePoints[0][0],
      pointerCircleCoords.y - mainCurvePoints[0][1],
    ];

    // pointer circle
    drawCircle(
      context,
      pointerCircleCoords,
      8,
      {
        width: config.circleWidth,
        color: config.circleColor
      }
    );

    var line = d3.line()
      .x(d => d[0])
      .y(d => d[1])
      .curve(d3.curveLinear)
      .context(context);

    var bezierLine = d3.line()
      .x(d => d[0])
      .y(d => d[1])
      .curve(d3.curveBasis)
      .context(context);

    var bezierLineRef = d3.line()
      .x(d => d[0])
      .y(d => d[1])
      .curve(d3.curveBasis);

    path.setAttribute('d', bezierLineRef(mainCurvePoints));

    context.beginPath();
    line(mainCurvePoints);
    context.lineWidth = config.defaultLineWidth;
    context.strokeStyle = config.defaultLineColor;
    context.stroke();

    context.beginPath();
    bezierLine(mainCurvePoints);
    context.lineWidth = config.mainLineWidth;
    context.strokeStyle = config.mainLineColor;
    context.stroke();

    const horizontalConnectLineEndCoords = {
      x: width,
      y: mainCurvePoints[mainCurvePoints.length - 1][1]
    };

    const horizontalConnectMainLineConfig = {
      color: config.mainLineColor,
      width: config.mainLineWidth
    };

    drawLine(
      context,
      {
        x: mainCurvePoints[mainCurvePoints.length - 1][0],
        y: mainCurvePoints[mainCurvePoints.length - 1][1],
      },
      horizontalConnectLineEndCoords,
      horizontalConnectMainLineConfig
    );

    mainCurvePoints.forEach((point, index) => {
      const p = {x: point[0], y: point[1]};

      p.text = [mainCurvePoints[index][0] - mainCurvePoints[0][0], mainCurvePoints[index][1] - mainCurvePoints[0][1]];
      drawCircle(context, p, 6, {color: 'black', width: 1});
    });

    if (targetPoints.length) {
      targetPoints.forEach((x, index) => {
        let y = null;

        if (x > mainCurvePoints[mainCurvePoints.length - 1][0]) {
          y = mainCurvePoints[mainCurvePoints.length - 1][1];
        } else {
          y = findYatX(x, path)[1];
        }

        const p = {
          x,
          y
        };

        p.text = [
          p.x - mainCurvePoints[0][0],
          p.y - mainCurvePoints[0][1],
        ]

        drawCircle(
          context,
          p,
          4,
          {
            width: config.targetPointWidth * 2,
            color: config.targetPointColor
          }
        );

        if (index === 0) {
          targetLineCoords = [{
            x,
            y,
          },{
            x,
            y: y + refsArray[0][0][1] - refsArray[0].topOffset
          }];

          let startLen = 0;

          for(let i = refsArray[0][0][0]; i <= refsArray[0][3][0]; i++) {
            const distanceOptions = {
              cubicBezier: {
                xs:[
                  refsArray[0][0][0],
                  refsArray[0][1][0],
                  refsArray[0][2][0],
                  refsArray[0][3][0]
                ],
                ys:[
                  refsArray[0][0][1],
                  refsArray[0][1][1],
                  refsArray[0][2][1],
                  refsArray[0][3][1]
                ]
              },
              x: i
            };

            const distance = getValOnCubicBezier_givenXorX(distanceOptions) - refsArray[0].topOffset;

            let bezierY = null;
            const currentX = x + i - config.canvasStartingPoint[0];

            if (currentX > mainCurvePoints[mainCurvePoints.length - 1][0]) {
              bezierY = mainCurvePoints[mainCurvePoints.length - 1][1];
            } else {
              const result = findYatX(currentX, path, startLen);
              bezierY = result[1];
              startLen = result[2];
            }

            if (distance) {
              targetLineCoords.push({
                x: x + i - config.canvasStartingPoint[0],
                y: bezierY + distance
              });
            }
          }

          targetLineCoords.push({
            x: width,
            y: targetLineCoords[targetLineCoords.length - 2].y
          });

          var line = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveLinear)
            .context(context);

          context.beginPath();
          line(targetLineCoords);
          context.lineWidth = config.targetLineWidth;
          context.strokeStyle = config.targetLineColor;
          context.stroke();
        }
      });
    }

    if (resultsPoints.length) {
      collectionsArray = [];

      resultsPoints.forEach((xPos, itemIndex) => {
        let collection = targetLineCoords;

        if (itemIndex) {
          collection = collectionsArray[itemIndex - 1];
        }
        const index = Math.ceil(xPos) - collection[0].x + 1;

        const pointCoords = {
          x: xPos,
          y: collection[index]
            ? collection[index].y
            : collection[collection.length - 1].y
        };

        pointCoords.text = [
          pointCoords.x - config.canvasStartingPoint[0],
          pointCoords.y - targetLineCoords[0].y,
        ];

        drawCircle(
          context,
          pointCoords,
          4,
          {
            width: config.targetPointWidth * 2,
            color: config.targetPointColor
          }
        );

        const iteratorSource = refsArray[itemIndex + 1];

        const resultLineCoords = [
          pointCoords,
          {
            x: pointCoords.x,
            y: pointCoords.y + iteratorSource[0][1] - iteratorSource.topOffset
          }
        ];

        for(let i = iteratorSource[0][0]; i < iteratorSource[iteratorSource.length - 1][0]; i++) {
          const distanceOptions = {
            cubicBezier: {
              xs:[
                iteratorSource[0][0],
                iteratorSource[1][0],
                iteratorSource[2][0],
                iteratorSource[3][0]
              ],
              ys:[
                iteratorSource[0][1],
                iteratorSource[1][1],
                iteratorSource[2][1],
                iteratorSource[3][1]
              ]
            },
            x: i
          };

          const distance = getValOnCubicBezier_givenXorX(distanceOptions) - iteratorSource.topOffset;

          if (distance) {
            let source = collection[index + i - config.canvasStartingPoint[0]];

            if (!source || !collection[index]) {
              source = collection[collection.length - 1];
            }

            resultLineCoords.push({
              x: collection[index]
                ? collection[index].x + i - config.canvasStartingPoint[0]
                : xPos + i - config.canvasStartingPoint[0],
              y: source.y + distance
            });
          }
        }

        resultLineCoords.push({
          x: width,
          y: resultLineCoords[resultLineCoords.length - 1].y
        });

        collectionsArray.push(resultLineCoords);

        var line = d3.line()
          .x(d => d.x)
          .y(d => d.y)
          .curve(d3.curveLinear)
          .context(context);

        context.beginPath();
        line(resultLineCoords);
        context.lineWidth = config.targetLineWidth;
        context.strokeStyle = config.targetLineColor;
        context.stroke();
      });
    }
  }

  d3.select(context.canvas)
    .call(drag, {radius: 20, refsArray, update})
    .call(update)
    .node();

  function handleMouseMove(){
    var xy = d3.mouse(this);

    var color = context.getImageData(xy[0], xy[1], 1, 1).data;

    let wasCatch = false;

    if (color[2] > 135 && color[2] < 145) { // blue
      if (pointerCircleCoords.x !== xy[0] && pointerCircleCoords.y !== xy[1]) {
        wasCatch = true;
        hoverOn = 'targetLine';
        pointerCircleCoords.x = xy[0];
        pointerCircleCoords.y = xy[1];
        update();
      }
    } else if (pointerCircleCoords.x !== -100) {
      hoverOn = null;
      pointerCircleCoords.x = -100;
      pointerCircleCoords.y = -100;
      update();
    }

    if (color[1] > 95 && color[1] < 105) { // green
      if (pointerCircleCoords.x !== xy[0] && pointerCircleCoords.y !== xy[1]) {
        hoverOn = 'resultsLine';
        pointerCircleCoords.x = xy[0];
        pointerCircleCoords.y = xy[1];
        pointerCircleCoords.y = xy[1];
        update();
      }
    } else if (pointerCircleCoords.x !== -100 && !wasCatch) {
      pointerCircleCoords.x = -100;
      pointerCircleCoords.y = -100;
      hoverOn = null;
      update();
    }
  };

  d3.select(context.canvas)
    .on('mousemove', handleMouseMove)
    .on('click', handleClick);

  let hoverOn = null;

  let inputProps = {};

  function handleFocus() {
    inputIsFocused = true;
    prevYValue = parseInt(this.value, 10);
  };

  function handleBlur() {
    inputIsFocused = false;
  };

  function handleClick() {
    let S = null;
    let R = 16;
    inputProps = {};

    refsArray.concat([mainCurvePoints]).forEach((points, index) => {
      for (const p of points) {
        const top = window.pageYOffset || document.documentElement.scrollTop;
        const left = window.pageXOffset || document.documentElement.scrollLeft;
        let r = Math.hypot(d3.event.x + left - p[0], d3.event.y + top - p[1]);
        if (r < R) {
          R = r;
          S = p;

          inputProps.isMainCurve = mainCurvePoints === points;
          inputProps.isLeftHandler = points.indexOf(p) === 0;
          inputProps.isRightHandler = points.indexOf(p) === (points.length - 1);
          inputProps.isTuner = points.indexOf(p) !== 0 && points.indexOf(p) !== (points.length - 1);
          inputProps.setIndex = index;
          inputProps.pointIndex = points.indexOf(p);
        }
      }
    });

    if (S) {
      coordsInputX.attr('disabled', null);
      coordsInputX.attr('title', '');
      coordsInputY.attr('disabled', null);
      coordsInputY.attr('title', '');

      coordsInputX.property('value', S[0] - config.canvasStartingPoint[0]);
      
      if (inputProps.isMainCurve) {
        coordsInputY.property('value', S[1] - mainCurvePoints[0][1]);

        if (inputProps.pointIndex === 0) {
          coordsInputX.attr('disabled', true);
          coordsInputX.attr('title', 'Изменение координаты X для этой точки не возможно');
        }
      } else {
        coordsInputY.property('value', S[1] - refsArray[inputProps.setIndex].topOffset);

        if (inputProps.isLeftHandler) {
          coordsInputX.attr('disabled', true);
          coordsInputX.attr('title', 'Изменение координаты X для этой точки не возможно');
        }

        if (inputProps.isTuner) {
          coordsInputY.attr('disabled', true);
          coordsInputY.attr('title', 'Изменение координаты Y для этой точки не возможно');
        }
      }

      coordsInputsContainer
        .style('left', `${ S[0] + 15 }px`)
        .style('top', `${ S[1] + 15 }px`)
        .style('display', 'block');

      if (coordsInputX.attr('disabled')) {
        coordsInputY.node().focus();
      } else {
        coordsInputX.node().focus();
      }

      function handleKeyDown() {
        if (d3.event.keyCode === 13) {
          const x = parseInt(coordsInputX.node().value, 10);
          const y = parseInt(coordsInputY.node().value, 10);

          if (!inputProps.isMainCurve) {
            if (inputProps.isLeftHandler) {
              if (y < 0) {
                alert('Координата Y не может быть отрицательной');
                return false;
              }

              const yLimit = refsArray[inputProps.setIndex][3][1] - refsArray[inputProps.setIndex].topOffset;

              if (y > yLimit) {
                alert('Координата Y не может быть больше ' + yLimitk);
                return false;
              }
              
              refsArray[inputProps.setIndex][0][0] = x + config.canvasStartingPoint[0];
              refsArray[inputProps.setIndex][0][1] = y + refsArray[inputProps.setIndex].topOffset;
              refsArray[inputProps.setIndex][1][1] = y + refsArray[inputProps.setIndex].topOffset;
            }


            if (inputProps.isRightHandler) {
              const xLimit = refsArray[inputProps.setIndex][1][0] - config.canvasStartingPoint[0];

              if (x < xLimit) {
                alert('Координата X не может быть меньше ' + xLimit);
                return false;
              }

              const yLimit = refsArray[inputProps.setIndex][0][1] - refsArray[inputProps.setIndex].topOffset;

              if (y < yLimit) {
                alert('Координата Y не может быть меньше ' + yLimit);
                return false;
              }

              refsArray[inputProps.setIndex][3][0] = x + config.canvasStartingPoint[0];
              refsArray[inputProps.setIndex][3][1] = y + refsArray[inputProps.setIndex].topOffset;
              refsArray[inputProps.setIndex][2][1] = y + refsArray[inputProps.setIndex].topOffset;

              const diff = prevYValue - y;

              for (let i = inputProps.setIndex + 1; i < refsArray.length; i++) {
                for (let j = 0; j < refsArray[i].length; j++) {
                  refsArray[i][j][1] -= diff;
                }

                refsArray[i].topOffset = refsArray[i - 1][3][1] + config.refsDistance;
              }

              for (let k = 0; k < mainCurvePoints.length; k++) {
                mainCurvePoints[k][1] -= diff;
              }
            }

            if (inputProps.isTuner) {
              if (x < 0) {
                alert('Координата X не может быть отрицательной');
                return false;
              }

              const xLimit = refsArray[inputProps.setIndex][3][0] - config.canvasStartingPoint[0];

              if (x > xLimit) {
                alert('Координата X не может быть больше ' + xLimit);
                return false;
              }

              refsArray[inputProps.setIndex][1][0] = x + config.canvasStartingPoint[0];
              refsArray[inputProps.setIndex][2][0] = x + config.canvasStartingPoint[0];
            }
          } else {
            if (x < 0) {
              alert('Координата X не может быть отрицательной');
              return false;
            }

            if (y < 0) {
              alert('Координата Y не может быть отрицательной');
              return false;
            }

            mainCurvePoints[inputProps.pointIndex][0] = x + config.canvasStartingPoint[0];
            mainCurvePoints[inputProps.pointIndex][1] = y + mainCurvePoints[0][1];
          }

          inputProps = {};
          coordsInputsContainer.style('display', 'none');
          update();
        }
      }

      coordsInputX.on('keypress', handleKeyDown);
      coordsInputY.on('keypress', handleKeyDown);
      coordsInputX.on('focus', handleFocus);
      coordsInputY.on('focus', handleFocus);
      coordsInputX.on('blur', handleBlur);
      coordsInputY.on('blur', handleBlur);
    }
    
    const [x,y] = d3.mouse(this);

    if (y >= mainCurvePoints[0][1] && hoverOn === 'targetLine') {
      const currentTargetPointXPosition = targetPoints[0];
      targetPoints[0] = Math.ceil(x);

      if (resultsPoints.length) {
        resultsPoints = resultsPoints.map(xPos => xPos + targetPoints[0] - currentTargetPointXPosition);
      }

      update();
    }

    if (hoverOn === 'resultsLine') {
      let theIndex = null;

      [targetLineCoords].concat(collectionsArray).forEach((arr, idx) => {
        const index = Math.ceil(x) - arr[0].x + 1;
        const item = index > arr.length ? arr[arr.length - 1] : arr[index];

        if (item && item.y <= y + 3 && item.y >= y - 3) {
          theIndex = idx;
        }
      });

      if (theIndex === collectionsArray.length) {
        if (refsArray.length > collectionsArray.length + 1) {
          resultsPoints.push(Math.ceil(x));

          update();
        } else if (theIndex >= collectionsArray.length) {
          alert('Для отрисовки необходимо добавить ещё одну референсную линию');
        }
      } else if (theIndex < collectionsArray.length) {
        const prev = resultsPoints[theIndex];
        resultsPoints[theIndex] = Math.ceil(x);

        for(let i = theIndex + 1; i < resultsPoints.length; i++) {
          resultsPoints[i] = resultsPoints[i] + (Math.ceil(x) - prev);
        }

        update();
      }
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
      let pointIndex = null;
      let isMainCurve;

      refsArray.concat([mainCurvePoints]).forEach((points, index) => {
        for (const p of points) {
          let r = Math.hypot(d3.event.x - p[0], d3.event.y - p[1]);
          if (r < R) {
            R = r;
            S = p;

            isMainCurve = mainCurvePoints === points;
            isLeftHandler = points.indexOf(p) === 0;
            isRightHandler = points.indexOf(p) === (points.length - 1);
            isTuner = points.indexOf(p) !== 0 && points.indexOf(p) !== (points.length - 1);
            setIndex = index;
            pointIndex = points.indexOf(p);
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
        pointIndex,
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
        pointIndex,
      } = d3.event.subject;

      const array = isMainCurve ? mainCurvePoints : refsArray[setIndex];

      if (!array) return false;

      const maxTop = array[3][1];

      if (!isLeftHandler && !isRightHandler && !isMainCurve) {
        array[1][0] = clamp(d3.event.x, array[0][0], array[3][0]);
        array[2][0] = clamp(d3.event.x, array[0][0], array[3][0]);
      }

      if (!isTuner) {
        let yCoord = null;

        if (isLeftHandler) {
          yCoord = clamp(d3.event.y, array.topOffset, array[array.length - 1][1]);
          array[1][1] = yCoord;
        }

        if (isRightHandler && !isMainCurve) {
          yCoord = clamp(d3.event.y, array[0][1], Infinity);
          array[2][1] = yCoord;

          const leftEdge = targetPoints.length && isMainCurve
            ? targetPoints[0] > array[2][0] ? targetPoints[0] : array[2][0]
            : array[2][0];

          array[3][0] = clamp(d3.event.x, leftEdge, width);
        }

        if (isMainCurve) {
          d3.event.subject.point[1] = d3.event.y;
        } else {
          d3.event.subject.point[1] = yCoord;
        }
      }

      if (isMainCurve && !isLeftHandler) {
        array[pointIndex][0] = d3.event.x;
        array[pointIndex][1] = clamp(d3.event.y, array[0][1], Infinity);
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

          plusButton.style('top', `${ refsArray[refsArray.length - 1][3][1] + 30 }px`);
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

    context.font = "10px Arial";
    context.fillText(`${ (p.text ? p.text[0] : p.x).toFixed(0) } ${ (p.text ? p.text[1] : p.y).toFixed(0) }`,p.x + 5,p.y - 5);

    if (options) {
      ctx.lineWidth = config.defaultLineColor;
      ctx.strokeStyle = config.defaultLineWidth;
    }
  }

  function drawPoints(ctx, points, options, array) {
    ctx.strokeStyle = options.color || config.defaultLineColor;

    points.forEach((p, index) => {
      let text = '';

      if (index === 0) {
        text = [0, array[0][1] - array.topOffset];
      } else if (index === 1) {
        text = [ array[1][0] - array[0][0], array[1][1] - array.topOffset ];
      } else if (index === 2) {
        text = [ array[2][0] - array[0][0], array[2][1] - array.topOffset ];
      } else if (index === 3) {
        text = [ array[3][0] - array[0][0], array[3][1] - array.topOffset ];
      }

      p.text = text;

      drawCircle(ctx, p, 6);
    });
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
    drawPoints(ctx, pts, {color: 'black'}, array);

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

    const horizontalConnectMainLineConfig = {
      color: config.mainLineColor,
      width: config.mainLineWidth
    };

    drawLine(
      ctx,
      horizontalConnectLineStartCoords,
      horizontalConnectLineEndCoords,
      isMain ? horizontalConnectMainLineConfig : connectLineConfig
    );

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

function findYatX(x, linePath, startLen) {
  function getXY(len) {
    var point = linePath.getPointAtLength(len);
    return [point.x, point.y, len];
  }
  var curlen = startLen || 0;
  while (getXY(curlen)[0] < x) { curlen += 1; }
  return getXY(curlen);
}
