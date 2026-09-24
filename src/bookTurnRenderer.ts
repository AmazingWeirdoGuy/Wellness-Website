import type { PaperSnapshot } from './bookPageSnapshot';
import { PAGE_SEGMENTS as SEGMENTS, writePageMesh } from './bookTurnGeometry';

export type TurnLeaf = { page: PaperSnapshot; index: number; front: WebGLTexture; back: WebGLTexture };

// One connected mesh samples one page texture. Shared vertices and continuous
// texture coordinates avoid the text seams produced by separate DOM strips.
export function createBookRenderer(width: number, height: number, stacked: boolean) {
  const canvas = document.createElement('canvas');
  canvas.className = 'book-turn-canvas';
  const padding = stacked ? 0 : 160;
  const canvasHeight = height + padding * 2;
  Object.assign(canvas.style, { width: `${width}px`, height: `${canvasHeight}px`, top: `${-padding}px` });
  // Keep sharp paper edges without overfilling low-density screens every frame.
  const ratio = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(canvasHeight * ratio);
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, premultipliedAlpha: false });
  if (!gl) throw new Error('Page rendering is unavailable');
  const shaders: WebGLShader[] = [];
  function shader(type: number, source: string) {
    const result = gl!.createShader(type)!;
    shaders.push(result);
    gl!.shaderSource(result, source);
    gl!.compileShader(result);
    if (!gl!.getShaderParameter(result, gl!.COMPILE_STATUS)) throw new Error('Page shader could not compile');
    return result;
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `
    attribute vec3 a_position;
    attribute vec2 a_uv;
    uniform vec2 u_size;
    uniform vec2 u_origin;
    uniform float u_padding;
    uniform float u_perspective;
    uniform float u_layer;
    varying vec2 v_uv;
    void main() {
      float w = 1.0 - a_position.z / u_perspective;
      vec2 origin = u_origin + vec2(0.0, u_padding);
      vec2 base = vec2(2.0 * origin.x / u_size.x - 1.0, 1.0 - 2.0 * origin.y / u_size.y);
      vec2 delta = (a_position.xy - u_origin) * vec2(2.0, -2.0) / u_size;
      gl_Position = vec4(base * w + delta, -a_position.z / 2000.0 - u_layer * w, w);
      v_uv = a_uv;
    }
  `));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    uniform sampler2D u_front;
    uniform sampler2D u_back;
    varying vec2 v_uv;
    void main() {
      gl_FragColor = gl_FrontFacing ? texture2D(u_front, v_uv) : texture2D(u_back, vec2(1.0 - v_uv.x, v_uv.y));
    }
  `));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Page renderer could not link');
  gl.useProgram(program);
  gl.uniform2f(gl.getUniformLocation(program, 'u_size'), width, canvasHeight);
  gl.uniform2f(gl.getUniformLocation(program, 'u_origin'), width / 2, height * 0.2);
  gl.uniform1f(gl.getUniformLocation(program, 'u_padding'), padding);
  gl.uniform1f(gl.getUniformLocation(program, 'u_perspective'), stacked ? 2200 : 3600);
  gl.uniform1i(gl.getUniformLocation(program, 'u_front'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'u_back'), 1);
  const layer = gl.getUniformLocation(program, 'u_layer');
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const vertices = new Float32Array((SEGMENTS + 1) * 2 * 5);
  gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, gl.DYNAMIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  const uv = gl.getAttribLocation(program, 'a_uv');
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12);
  const indices = new Uint16Array(SEGMENTS * 6);
  for (let i = 0; i < SEGMENTS; i++) indices.set([2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 2, 2 * i + 1, 2 * i + 3], i * 6);
  const indexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const textures: WebGLTexture[] = [];

  function texture(image: HTMLCanvasElement) {
    const result = gl!.createTexture()!;
    textures.push(result);
    gl!.bindTexture(gl!.TEXTURE_2D, result);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, image);
    return result;
  }

  function draw(leaves: TurnLeaf[], elapsed: number, duration: number, stagger: number, forward: boolean) {
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    gl!.frontFace(forward ? gl!.CCW : gl!.CW);
    for (const { page, index, front, back } of leaves) {
      const p = Math.max(0, Math.min(1, (elapsed - index * stagger) / duration));
      writePageMesh(vertices, page, p, forward);
      // Layer ordering belongs in the depth buffer, not a visible paper lift.
      gl!.uniform1f(layer, (p < 0.5 ? leaves.length - index : index + 1) * 0.00001);
      gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, vertices);
      gl!.activeTexture(gl!.TEXTURE0); gl!.bindTexture(gl!.TEXTURE_2D, front);
      gl!.activeTexture(gl!.TEXTURE1); gl!.bindTexture(gl!.TEXTURE_2D, back);
      gl!.drawElements(gl!.TRIANGLES, indices.length, gl!.UNSIGNED_SHORT, 0);
    }
  }

  function reset() {
    textures.forEach((item) => gl!.deleteTexture(item));
    textures.length = 0;
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    canvas.remove();
  }

  function dispose() {
    reset();
    shaders.forEach((item) => gl!.deleteShader(item));
    gl!.deleteBuffer(buffer); gl!.deleteBuffer(indexBuffer); gl!.deleteProgram(program);
    gl!.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.width = canvas.height = 0;
  }
  return { canvas, texture, draw, reset, dispose, isContextLost: () => gl!.isContextLost() };
}

export function blankPaper(page: PaperSnapshot) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(page.width * 2);
  canvas.height = Math.ceil(page.height * 2);
  const context = canvas.getContext('2d')!;
  context.scale(2, 2);
  context.fillStyle = '#fefcf5'; context.fillRect(0, 0, page.width, page.height);
  context.strokeStyle = 'rgba(73,52,48,.15)'; context.lineWidth = 1;
  context.strokeRect(20, 20, page.width - 40, page.height - 40);
  context.strokeStyle = 'rgba(73,52,48,.07)';
  for (let y = page.height * 0.22; y < page.height * 0.88; y += 32) {
    context.beginPath(); context.moveTo(page.width * 0.12, y); context.lineTo(page.width * 0.88, y); context.stroke();
  }
  return canvas;
}
