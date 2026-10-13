import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// TSL
import { materialColor, Fn, color, pow, vec2, vec3, mat3, float, min, length, smoothstep, mx_noise_float, rtt, sin, cos, mul, add, div, uv, uniform, time, greaterThanEqual, lessThanEqual, abs, mix, sub, select, distance } from 'three/tsl';

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

  const fondoGris = vec3(uv().x);
  const fondoVerde = vec3(0.0, 1.0, 0.0);

  // f(x)=x => y=x (Para graficar una recta: si pixelActual.distancia.xy = valorFuncion.xy => es un punto de la recta (pintar verde). Si no, pintar azul. Para evitar una recta casi invisible, darle un grosor)
  const distancia = distance(uv().y, uv().x);

  // Verificar qué porcentaje representa esa distancia entre mis rangos (0.0 están en el mismo punto, entre [0.0, 0.2] interpolar, fuera del rango, cero.)
  const porcentajeVerde = smoothstep(0.02, 0.0, distancia);// Toma un valor y retorna el porcentaje que representa en el rango, o uno de los límites si está fuera

  // Traducir ese porcentaje a un brillo del canal verde (mínimo brillo, máximo, o interpolado)
  const canalesInterpolados = mix(fondoGris, fondoVerde, porcentajeVerde); // mix es una función de interpolación. Entra un porcentaje y retorna un valor que equivale a ese porcentaje en el rango.



  return color(canalesInterpolados);
}


function pintarFondoCircunferencia() {
  // Una circunferencia se define por su radio (r), que determina cuántas unidades medirá de diámetro.
  // Se puede pintar un pixel de la circunferencia Sí y sólo sí: La distancia del centro (0,0) al pixel actual (uv()), es la misma que las unidades del radio.
  // ¿Por comodidad? Se puede simular el cambio del centro de coordenadas de un material restando 0.5 a cada pixel en las componentes x,y
  // DISTANCIA ENTRE DOS PUNTOS (fn distance) != Longitud (fn length) de vector. 
  const radio = 0.25;
  const colorDegradadoFondo = vec3(uv().x);
  const colorVerde = vec3(0.0, 1.0, 0.0);

  // En colores, sí suele ser mejor utilizar el rango [0.0, 1.0], porque las computadoras no interpretan números negativos para canales de color.
  const pixelActualOrigenCero = uv().sub(0.5);

  const distanciaAlRadio = abs(length(pixelActualOrigenCero).sub(radio));

  // Obtener el porcentaje de brillo
  const porcentajeBrillo = smoothstep(0.01, 0.0, distanciaAlRadio);

  // Interpolar el canal verde con el fondo || pintarlo a 100% || no pintarlo
  const canalesInterpolados = mix(colorDegradadoFondo, colorVerde, porcentajeBrillo);

  return color(canalesInterpolados);

}




// Printando el lienzo. (si aumentamos los 3 canales de 0.0 a 1.0, eventualmente alcanzará blanco)
materialPlano.colorNode = pintarFondoCircunferencia();









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