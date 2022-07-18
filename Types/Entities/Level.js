let _assets, darkenBuffer, darkenBufferScreen


function Level(spec) {
  const {
    self,
    assets,
    screen,
    ui,
  } = Entity(spec, 'Level')

  _assets = assets

  const {
    globalScope,
    levelCompleted,
    datum,
    isBubbleLevel,
    quad,
  } = spec

  let {
    colors = Colors.biomes.alps,
    defaultExpression,
    hint = '',
    openMusic,
    runMusic,
    flashMathField = false,
    flashRunButton = false,
    camera: cameraSpec = {}
  } = datum
  
  const sledders = []
  const walkers = []
  const goals = []
  const texts = []
  const sprites = []
  const speech = []
  const directors = []
  const bubbles = []
  const sounds = []
  
  let lowestOrder = 'A'
  let highestOrder = 'A'

  if (flashMathField)
    ui.expressionEnvelope.classList.add('flash-shadow')
  else
    ui.expressionEnvelope.classList.remove('flash-shadow')

  if (flashRunButton)
    ui.runButton.classList.add('flash-shadow')
  else
    ui.runButton.classList.remove('flash-shadow')

  let currentLatex

  const trackedEntities = [speech, sledders, walkers, goals]

  // TODO: Fix hint text. Mathquill broke it
  // ui.mathField.setAttribute('placeholder', hint)

  openMusic = _.get(assets, openMusic, null)
  runMusic = _.get(assets, runMusic, null)

  let hasBeenRun = false

  camera = Camera({
    globalScope,
    parent: self,
    ...cameraSpec,
  })

  const axes = Axes({
    drawOrder: LAYERS.axes,
    camera,
    globalScope,
    parent: self,
  })

  trackedEntities.unshift(axes)

  // Credit for screen buffer business logic to LevelBubble.js by @cwalker
  let darkenBufferOpacity = 0.0
  darkenBuffer = ScreenBuffer({
    parent: self,
    screen,
    drawOrder: LAYERS.lighting,
    postProcess: (ctx, width, height) => {
      // Darken screen
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = `rgba(1.0, 0.5, 0, ${darkenBufferOpacity})`
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'
    }
  })

  darkenBufferScreen = Screen({
    canvas: darkenBuffer.canvas,
  })

  const graph = Graph({
    camera,
    screen: darkenBufferScreen,
    globalScope,
    expression: mathquillToMathJS(defaultExpression),
    parent: self,
    drawOrder: LAYERS.graph,
    colors,
  })

  let shader = null // Only loaded for Constant Lake

  let completed = false

  let skyColors = colors.sky

  if (_.isString(skyColors))
    skyColors = [[0, skyColors]]

  let skyGradient = screen.ctx.createLinearGradient(0, 0, 0, 1)

  for (const color of skyColors)
    skyGradient.addColorStop(color[0], color[1])

  loadDatum(spec.datum)

  const defaultVectorExpression = '\\frac{(\\sin(x) - (y - 2) \\cdot i) \\cdot i}{2}'

  function awake() {
    refreshLowestOrder()

    // Add a variable to globalScope for player position
    globalScope.p = math.complex()
    assignPlayerPosition()
    
    if (isConstantLake()) {
      // Change editor to vector field and hide until
      // star field comes out
      ui.expressionEnvelope.classList.add('hidden')
      ui.mathFieldLabel.innerText = 'V='

      ui.mathField.latex(defaultVectorExpression)
      ui.mathFieldStatic.latex(defaultVectorExpression)
    } else {
      // Otherwise display editor normally as graph editor
      ui.expressionEnvelope.classList.remove('hidden')
      ui.mathFieldLabel.innerText = 'Y='

      ui.mathField.latex(defaultExpression)
      ui.mathFieldStatic.latex(defaultExpression)
    }
  }

  function start() {
  }

  function startLate() {
    // self.sendEvent('levelFullyStarted')
  }

  function tick() {
    let time = (Math.round(globalScope.t*10)/10).toString()

    if (globalScope.running && !_.includes(time, '.'))
      time += '.0'

    // ui.timeString.innerHTML = 'T='+time
    ui.runButtonString.innerHTML = 'T='+time
    ui.stopButtonString.innerHTML = 'T='+time

    assignPlayerPosition()
  }

  function draw() {
    if (isConstantLake() &&
        walkers[0] &&
        walkers[0].transform.position) {
      const x = walkers[0].transform.position.x

      drawConstantLakeEditor(x)
      darkenBufferOpacity = Math.min(0.9, Math.pow(x / 20, 2))

      const walkerDarkenOpacity = Math.pow(darkenBufferOpacity, 5)

      for (const walker of walkers) {
        walker.darkModeOpacity = walkerDarkenOpacity

        for (const w of walker.walkers) {
          if (w.hasDarkMode)
            w.darkModeOpacity = walkerDarkenOpacity
        }
      }
    }

    screen.ctx.save()
    screen.ctx.scale(1, screen.height)
    screen.ctx.fillStyle = skyGradient
    
    datum.sky ? 0 : screen.ctx.fillRect(0, 0, screen.width, screen.height)
    screen.ctx.restore()
  }

  function assignPlayerPosition() {
    const playerEntity = walkers.length > 0 ?
      walkers[0] : sledders.length > 0 ?
      sledders[0] : axes

    globalScope.p.re = playerEntity.transform.position.x
    globalScope.p.im = playerEntity.transform.position.y
  }

  function trackDescendants(entity, array=trackedEntities) {
    _.each(entity.children, v => {
      array.push(v)
      trackDescendants(v, array)
    })
  }

  function addGoal(goalDatum) {
    const generator = {
      'path': PathGoal,
      'fixed': FixedGoal,
      'dynamic': DynamicGoal,
    }[goalDatum.type || 'fixed']

    const goal = generator({
      name: 'Goal '+goals.length,
      parent: self,
      camera,
      graph,
      assets,
      sledders,
      globalScope,
      drawOrder: LAYERS.goals,
      goalCompleted,
      goalFailed,
      getLowestOrder: () => lowestOrder,
      ...goalDatum
    })

    goals.push(goal)
  }

  function addDirector(directorDatum) {
    const generator = {
      'tracking': TrackingDirector,
      'waypoint': WaypointDirector,
      'lerp': LerpDirector,
      // 'drag': DragDirector,
    }[directorDatum.type || 'tracking']

    const director = generator({
      parent: self,
      camera,
      graph,
      globalScope,
      trackedEntities,
      ...directorDatum
    })

    directors.push(director)
  }
  
  function addTextBubbles(bubbleDatum) {
    bubbles.push(
      TextBubble({
        parent:self,
        camera,
        graph,
        globalScope,
        visible: false,
        place: 'top-right',
        ...bubbleDatum
      })
    )
  }

  function addWalker(walkerDatum) {
    const walker = Walker({
      name: 'Walker '+walkers.length,
      parent: self,
      camera,
      graph,
      globalScope,
      screen: darkenBufferScreen,
      speechScreen: screen,
      drawOrder: LAYERS.walkers,
      hasDarkMode: isConstantLake(),
      ...walkerDatum
    })

    walkers.push(walker)

    trackDescendants(walker)
  }

  function addSledder(sledderDatum) {
    const sledder = Sledder({
      name: 'Sledder '+sledders.length,
      parent: self,
      camera,
      graph,
      globalScope,
      screen: darkenBufferScreen,
      drawOrder: LAYERS.sledders,
      speechScreen: screen,
      ...sledderDatum,
    })

    sledders.push(sledder)

    trackDescendants(sledder, speech)
  }

  function addSound(soundDatum) {
    const sound = Sound({
      name: 'Sound ' + soundDatum.asset,
      parent: self,
      walkers,
      ...soundDatum,
    })

    sounds.push(sound)
  }

  function addSprite(spriteDatum) {
    const sprite = Sprite({
      name: 'Sprite '+sprites.length,
      parent: self,
      camera,
      graph,
      globalScope,
      drawOrder: LAYERS.backSprites,
      anchored: true,
      screen: darkenBufferScreen,
      speechScreen: screen,
      ...spriteDatum,
    })

    sprites.push(sprite)
  }

  function addText(textDatum) {
    const text = Text({
      name: 'Text '+texts.length,
      parent: self,
      camera,
      globalScope,
      drawOrder: LAYERS.text,
      bucket: 2,
      ...textDatum,
    })

    texts.push(text)
  }

  function goalCompleted(goal) {
    if (!completed) {
      refreshLowestOrder()

      let levelComplete = true

      for (goal of goals) {
        if (!goal.completed) {
          levelComplete = false
          break
        }
      }

      assets.sounds.goal_success.play()

      if (levelComplete) {
        completed = true
        levelCompleted()
        assets.sounds.level_success.play()
      }
    }
  }

  function goalFailed(goal) {
    if (goal.order) {
      for (g of goals) {
        if (g.order && !g.completed)
          g.fail()
      }
    }

    assets.sounds.goal_fail.play()
  }

  function playOpenMusic() {
    if (openMusic)
      openMusic.play()
  }

  function reset() {
    ui.mathField.latex(defaultExpression)
    // self.sendEvent('setGraphExpression', [defaultExpression, defaultExpression])
    refreshLowestOrder()
  }

  function refreshLowestOrder() {
    lowestOrder = 'Z'
    for (goal of goals) {
      if (!goal.completed && goal.order < lowestOrder) {
        lowestOrder = goal.order
      }
    }

    _.invokeEach(goals, 'refresh')
  }

  function startRunning() {
    ui.runButton.classList.remove('flash-shadow')

    ui.mathFieldStatic.latex(currentLatex)

    if (!hasBeenRun) {
      if (runMusic)
        runMusic.play()

      hasBeenRun = true
    }
  }

  function stopRunning() {
    _.invokeEach(goals, 'reset')
    _.invokeEach(bubbles, 'toggleVisible')
    completed = false
    refreshLowestOrder()
  }

  function isConstantLake() {
    return datum.name === 'Constant Lake'
  }

  let isVectorEditorActive = false

  function drawConstantLakeEditor(walkerPositionX) {
    if (walkerPositionX > 18.5) {
      if (!isVectorEditorActive) {
        isVectorEditorActive = true

        ui.expressionEnvelope.classList.remove('hidden')

        ui.expressionEnvelope.animate([
          { transform: 'translateY(calc(100% + 20px))', opacity: '0' },
          { transform: 'translateY(0px)', opacity: '1' },
          // { opacity: '0' },
          // { opacity: '1' },
        ], {
          duration: 1700,
          easing: 'ease-out',
          fill: 'forwards'
        })
      }
    } else if (walkerPositionX < 17.5 && isVectorEditorActive) {
      isVectorEditorActive = false

      const animation = ui.expressionEnvelope.animate([
        { transform: 'translateY(0px)', opacity: '1' },
        { transform: 'translateY(calc(100% + 20px))', opacity: '0' },
        // { opacity: '1' },
        // { opacity: '0' },
      ], {
        duration: 1700,
        easing: 'ease-out',
      })

      animation.onfinish = () => {
        ui.expressionEnvelope.classList.add('hidden')
      }
    }
  }

  function loadDatum(datum) {
    if (!isBubbleLevel)
      _.each(datum.sounds, addSound)
    _.each(datum.sprites, addSprite)
    _.each(datum.walkers, addWalker)
    _.each(datum.sledders, addSledder)
    _.each(datum.goals, addGoal)
    _.each(datum.texts, addText)
    _.each(datum.directors || [{}], addDirector)
    isBubbleLevel || _.each(datum.textBubbles || [], addTextBubbles)
    if (datum.clouds) 
      CloudRow({
        parent:self,
        camera,
        globalScope,
        velocity: datum.clouds.velocity,
        heights: datum.clouds.heights,
        drawOrder: LAYERS.clouds,
        screen: darkenBufferScreen,
        ...datum.clouds,
      })
    // Constant Lake sunset scene
    if (!isBubbleLevel && isConstantLake()) {
      shader = Shader({
        parent: self,
        screen,
        assets,
        quad,
        drawOrder: LAYERS.sky,
        defaultExpression: '(sin(x)-(y-2)*i)*i/2',
        walkerPosition: walkers[0].transform.position,
      })
    } else {
      shader = null
    }
    if (datum.sky)
      Sky({
        parent: self,
        camera,
        globalScope,
        asset: datum.sky.asset,
        margin: datum.sky.margin,
        screen: darkenBufferScreen,
        drawOrder: LAYERS.background,
        ...datum.sky,
      })
    if (datum.snow) 
      SnowFall({
        parent:self,
        camera,
        globalScope,
        screen,
        density: datum.snow.density,
        velocityX: datum.snow.velocity.x,
        velocityY: datum.snow.velocity.y,
        maxHeight: datum.snow.maxHeight,
        drawOrder: LAYERS.snow,
        screen: darkenBufferScreen,
        ...datum.snow,
      })

    if (datum.slider && !isBubbleLevel) {
      HintGraph({
        ui,
        parent: self,
        camera,
        screen,
        globalScope,
        drawOrder: LAYERS.hintGraph,
        slider: datum.slider,
      })
    }

    self.sortChildren()
  }


  function setGraphExpression(text, latex) {
    ui.mathFieldStatic.latex(latex)

    if (isConstantLake()) {
      shader.setVectorFieldExpression(text)
      return
    }

    graph.expression = text
    currentLatex = latex

    graph.expression = text
    ui.expressionEnvelope.setAttribute('valid', graph.valid)

    _.invokeEach(sledders, 'reset')
    _.invokeEach(goals, 'reset')
  }

  function mathFieldFocused() {
    ui.expressionEnvelope.classList.remove('flash-shadow')
  }

  function destroy() {
    _.invokeEach(bubbles, 'destroy')
  }

  function resize(width, height) {
    console.log('Resize event called in Level')
    darkenBufferScreen.resize()
    graph.resize()
  }
  
  return self.mix({
    awake,
    start,
    destroy,
    
    tick,
    draw,

    resize,

    startRunning,
    stopRunning,

    setGraphExpression,

    camera,
    graph,
    
    reset,

    playOpenMusic,

    mathFieldFocused,

    get datum() {return spec.datum},
    get completed() {return completed},
  })
}