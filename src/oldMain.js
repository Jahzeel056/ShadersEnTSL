import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// TSL
import { materialColor, Fn, color, pow, vec2, vec3, mat3, float, min, length, smoothstep, mx_noise_float, rtt, sin, cos, mul, add, div, uv, uniform, time, greaterThanEqual, lessThanEqual, abs, mix, sub, select } from 'three/tsl';

// Definir escena
const scene = new THREE.Scene();
scene.background = new THREE.Color('black')
// El color de la escena es blanco por defecto al usar WebGPURenderer, así que lo puedo cambiar a negro.
//scene.background = new THREE.Color('black');
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

// Configuración del Canva y renderer (dimensiones en las que renderiza)
const renderer = new THREE.WebGPURenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometriaPlano = new THREE.PlaneGeometry(3, 3, 20, 23);

const materialPlano = new THREE.MeshStandardNodeMaterial({
  //color: 'white',
  //wireframe: true
});
// Plano con doble cara para que interactúe con luz de ambos lados
materialPlano.side = THREE.DoubleSide;

const meshPlano = new THREE.Mesh(geometriaPlano, materialPlano);

scene.add(meshPlano);

// Configurar cámara antes de renderizar
camera.position.z = 6;
camera.lookAt(0, 0, 0);

// Configurar controles de Órbita y Ejes
const controles = new OrbitControls(camera, renderer.domElement);
//controles.target.copy(meshPlano.position);
const ejes = new THREE.AxesHelper(7, 7, 7);
scene.add(ejes);

// Luz ambiente
const luzAmbiente = new THREE.AmbientLight('white', 3);
scene.add(luzAmbiente);

// Luz puntual 
const luzPuntual = new THREE.PointLight('white', 15, 10);
//scene.add(luzPuntual);
//luzPuntual.position.set(2, 0, 2);


// UNIFORM de color
const colorBase = uniform( new THREE.Color( 0xababff ) );

// Shaders del plano
//const condicionPintar = mul(uv().x, uv().y).greaterThanEqual()

/* 
Dibujar verde puro cuando el pixel esté en la función.
Dibujar verde interpolado con el fondo cuando el pixel esté a un grosor/rango determinado.
Dibujar sólo el fondo si el pixel está a una distancia fuera del rango.
*/

// Para esto, podría usar lógica con 'condicionales' o algún truco 'secuencial' (en GPU todo es paralelo)
// Pero esta es una aproximación puramente matemática, que es en la que obligan a pensar los shaders
function pintarFondoYRecta() {
  // ¿cómo saber cuándo pintar la recta f(x)=x? Cuando la altura entre el pixelAcutal y la alturaActual de la función sea 0. (valor evaluado = altura pixel)
  // Esto no es más que la distancia entre ambos (ignorando por debajo o arriba de la función, signos).
  const distancia = abs(uv().y.sub(pow(uv().x, 1))); // uv().y(alturaPixel) - uv().x(Y evaluado en x, que no es mas que X al ser funcion lineal)

  // dist: 0.0 = pintar full verde , 0.2 = interpolar entre el fondo, cualquier otro = no pintar
  // Aquí, smoothStep(que interpola, sólo que retorna un porcentaje según el valor entrante), funciona como mapeo/o similar a un condicional para lo que sigue.
  const intensidad = smoothstep(0.02, 0.0, distancia); // Si la distancia es 0, retorna 1.0 como porcentaje. Si distancia es mayor que 0.2, retorna 0.0, si está entre esos valores, retorna el porcentaje que representa ese valor. 
  // También llamado 'mapa de porcentajes pixel por pixel'. De esta forma, la GPU sabrá qué porcentaje aplicar a cada uno.


  // EL PORCENTAJE RETORNADO, SE USA COMO INTENSIDAD para el ganal verde, sea: 100%, interpolado, o 0% de contribución.
  const fondoGrisGradiente = vec3(uv().x); // equivale a r,g,b
  const lineaVerde = vec3(0.0, 1.0, 0.0); // Color a pintar si es 100% (distancia 0)
  
  const canalesResultantes = mix(fondoGrisGradiente, lineaVerde, intensidad); // Esto sí es una interpolación lineal. Si el porcentaje de entrada es 1.0, el valor de retorno será 1.0(verde), si no, se interpola entre el fondo, o se queda como 0.

  // Y, como estábamos interpolando vectores, el resultado es un vector que contiene los canales rgb ya calculados según el fondo y la función.
  return color(canalesResultantes);

}





// Printando el lienzo. (si aumentamos los 3 canales de 0.0 a 1.0, eventualmente alcanzará blanco)
materialPlano.colorNode = pintarFondoYRecta();









// Configurar resize de la pantalla
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// Renderizar
const reloj = new THREE.Timer();

function animate(tiempo) {
  reloj.update(); // Actualizar timer antes de obtener parámetros
  renderer.render(scene, camera);
  //x=r*sin(t), z=r*cos(t) | plano polar
  let elapsed = reloj.getElapsed();
  // Rotando la pointlight
  //luzPuntual.position.x = 3*Math.sin(elapsed*3);
  //luzPuntual.position.z = 3*Math.cos(elapsed*3);

}


// Animar renderizado (continuo)
renderer.setAnimationLoop(animate);