/**
 * Utility functions for WebGL.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @returns {Object} The GLUtils object.
 */
function GLUtils(gl) {
  const self = {};
  const FLOAT_SIZE = 4;

  /**
   * Sets the viewport dimensions.
   * @param {number} width - The width of the viewport.
   * @param {number} height - The height of the viewport.
   */
  function viewport(width, height) {
    gl.viewport(0, 0, width, height);
  }

  /**
   * Clears the WebGL context.
   */
  function clear() {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Creates and compiles a shader program.
   * @param {Object} shaders - The vertex and fragment shaders.
   * @param {string} shaders.vert - The vertex shader source.
   * @param {string} shaders.frag - The fragment shader source.
   * @returns {Object} The shader program object.
   */
  function Program({ vert, frag }) {
    const self = { vert, frag };
    const program = gl.createProgram();

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vert);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Error compiling vertex shader:', gl.getShaderInfoLog(vertexShader));
      throw new Error(`Error compiling vertex shader: ${gl.getShaderInfoLog(vertexShader)}`);
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, frag);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Error compiling fragment shader:', gl.getShaderInfoLog(fragmentShader));
      throw new Error(`Error compiling fragment shader: ${gl.getShaderInfoLog(fragmentShader)}`);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Error linking program:', gl.getProgramInfoLog(program));
      throw new Error(`Error linking program: ${gl.getProgramInfoLog(program)}`);
    }

    self.use = () => {
      gl.useProgram(program);
      return self;
    };

    let locations = {
      attributes: {},
      uniforms: {},
    };

    /**
     * Gets the location of an attribute.
     * @param {string} name - The name of the attribute.
     * @returns {number} The location of the attribute.
     */
    const getAttribute = (name) => {
      let location = locations.attributes[name];
      if (location === undefined) {
        location = gl.getAttribLocation(program, name);
        if (location === -1) {
          console.trace();
          throw new Error(`Unable to find location of attribute '${name}' in shader program`);
        }
        locations.attributes[name] = location;
      }
      return location;
    };

    /**
     * Sets up instanced attributes.
     * @param {Object} ext - The WebGL extension for instanced arrays.
     * @param {Object} array - The array buffer.
     * @param {Array} layout - The layout of the attributes.
     */
    self.instancedAttributes = (ext, array, layout) => {
      array.bind();

      for (const { type, name, perInstance, stride = null, offset = null } of layout) {
        const location = getAttribute(name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, type.size, type.type, false, stride, offset);
        if (perInstance) {
          ext.vertexAttribDivisorANGLE(location, 1);
        }
      }
    };

    return self;
  }

  self.viewport = viewport;
  self.clear = clear;
  self.Program = Program;

  return self;
}
