import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// TSL
import { positionLocal, screenCoordinate, viewportSize, screenSize, materialColor, Fn, color, pow, vec2, vec3, mat3, min, length, smoothstep, mx_noise_float, rtt, sin, cos, mul, add, div, mod, equal, uv, uniform, time, greaterThanEqual, lessThanEqual, lessThan, or, and, abs, mix, sub, select, distance, fract, step, float, dot, floor, ceil, vec4 } from 'three/tsl';

// Definir escena
const scene = new THREE.Scene();
//scene.background = new THREE.Color('black')
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

// Rendija de crecimiento infinito (multiplicar por time aumenta el rango, y el seno (absoluto) repite el patrón de 0 a 1 múltiples veces)
function rendijaInfinita() {
  // ¿Por qué se repite infinitamente? Por multiplicar cada pixel (u,v) por un número más grande cada vez (time)
  // Similar a cuando se cambia el centro de coordenadas a (0.0, 0.0) restándole 0.5 a cada pixel.
  // Entonces, multiplicar cada píxel por un número, es una TRANSFORMACIÓN LINEAL del marco de referencia.
  // El plano(cartesiano) deja de medir de [0.0,1.0] a [0.0, time*1.0] EN CADA FRAME. (ES UN ZOOM_OUT, o símpelemente se agranda el marco de referencia)
  
  /*como 'hay más espacio en el marco de referencia', la función seno puede repetir más veces el patrón visible.*/

  const coordsCentroCero = uv().sub(0.5);

  // El seno siempre oscila entre 0 y 1 por el valor absoluto (se puede aumentar frecuencia para velocidad)
  //return color(abs(sin(uv().mul(time))), 1);
  // También se puede repetir el mismo patrón en los cuatro cuadrantes si el centro es (0.0, 0.0)
  //return color(abs(sin(coordsCentroCero.mul(time.mul(2)))), 1);


  // ------------- (segunda forma)

  // Usando fract: 'fract() corta el espacio cada 1.0 unidad, creando "sub-marcos" repetitivos de [0.0, 1.0)'
  // A diferencia del primer shader, este marco de referencia no crece al infinito
  //return color(sin(fract(uv().mul(time))), 1); // el valor absoluto lo cambia sutilmente (visual)?

  // Aquí, escalamos el marco de [0.0, 1.0] a [0.0, 2.0], lo que hace que fract se repita 2 veces desde [0.0, 1.0)
  return color(fract( uv().mul( 2.0 ) ));
  
  // Sabiendo eso, podemos escalar el marco de ref. cuantas veces queramos para obtener patrones repetitivos de lo que se pinta
  //return color(fract( uv().mul(time) ), 1.0);
}

// Shaping functions: Tienen una entrada (num) y lo esculpen a una 'forma' determinada
function rendijasFormas() {

  // Seteando el espacio de coordenadas.
  //1. step(límite, x): Compara una referencia, con una variable de entrada. Si referencia > entrada, retorna 0.0, otra forma retorna 1.0.
  //canales = step(0.0, canales); // Como el eje X va de [-0.5, 0.5], el step retorna 1 cuando uv().x > 0.0

  //2. SmoothStep(min, max, valor): Genera una curva/transición suave
  //canales = smoothstep(-0.5, 0.5, canales); // retorna el porcentaje de brillo

  // Seguir con TheBook. No entendí.
  return color(uv().x);
}

function pintarMultiplos025X() {
  // Así es como inicié pintando lo puntos. Luego, combiné a que sólo se pintaran si en X e Y eran múltiplos
    // Definir los nodos de la grid que tendrán un vector gradiente
  const nodosGrid = [vec2(0.5, 0.5), vec2(0.5, 0.25), vec2(0.5, 0.75)];

  const verde = vec3(0.0, 1.0, 0.0);

  // Como equal(0.0) evalúa con presición, mejor pintar los pixeles cercanos en vez de aquellos púramente múltiplos de 0.25
  const condicionPintar = length(uv().x).mod(0.25).lessThan(0.01);

  // Cuando se llega a x=0.99, 0.99%0.25 da 0.24, y no se cumple 'condicionPintar', provocando que el borde derecho no pinte sus puntos.
  // Para esto, agrego una condición OR cuando UV.x >= 0.99
  const condicionBordeDerecho = condicionPintar.or(uv().x.greaterThanEqual(0.99));
  
  // Porcentaje: condición retorna 0 o 1. En el smoothStep: si es 0(false), retorna 0.0. Y 1.0 si es true. (o simplemente retornar 1 o 0 sin el smooth. También se puede con step.)
  const porcentaje = select(condicionBordeDerecho, smoothstep(0.0, 1.0, condicionBordeDerecho), 0); // me retorna el porcentaje al que brillarán, para anularlo, tomo los porcentajes mayores que 0.9
  // como la condición ya retorna si se pinta o no, no hace falta el smoothstep, retornar 1 o 0.
  // const porcentaje = select(condicionPintar, 1.0, 0.0); (recomendación IA)

  const canal = mix(verde, vec3(1.0, 0.0, 0.0), porcentaje);

  return color(canal);
}

// Intentando perlin Noise
function fragmentShaderPerlin() {

  // Definir los nodos de la grid que tendrán un vector gradiente (no lo utilicé porque no sabía como recorrer un array en un shader, pero ahora sé que existe Loop.)
  const nodosGrid = [vec2(0.5, 0.5), vec2(0.5, 0.25), vec2(0.5, 0.75)];

  const verde = vec3(0.0, 1.0, 0.0);

  // Como equal(0.0) evalúa con presición, mejor pintar los pixeles cercanos en vez de aquellos púramente múltiplos de 0.25
  const condicionPintar = length(uv().x).mod(0.25).lessThan(0.01);

  // Cuando se llega a x=0.99, 0.99%0.25 da 0.24, y no se cumple 'condicionPintar', provocando que el borde derecho no pinte sus puntos.
  // Para esto, agrego una condición OR cuando UV.x >= 0.99
  const condicionBordeDerecho = condicionPintar.or(uv().x.greaterThanEqual(0.99));
  
  // Condición pintar Y (LA CONDICIÓN DE pintarX 'Y' pintarY DEBEN CUMPLIRSE PARA PINTAR EL PUNTO, NO LOS PUNTOS (líneas))
  const condicionPintarY = length(uv().y).mod(0.25).lessThan(0.01);
  
  const condicionPintarPuntos = condicionBordeDerecho.and(condicionPintarY);

  // Si no se usa condición borde derecho al final, el (1,1) no se pinta
  const condicionBordeSuperior = condicionPintarPuntos.or(uv().y.greaterThanEqual(0.99).and(condicionBordeDerecho));

  // Porcentaje: condición retorna 0 o 1. En el smoothStep: si es 0(false), retorna 0.0. Y 1.0 si es true. (o simplemente retornar 1 o 0 sin el smooth. También se puede con step.)
  const porcentaje = select(condicionBordeSuperior, smoothstep(0.0, 1.0, condicionBordeSuperior), 0); // me retorna el porcentaje al que brillarán, para anularlo, tomo los porcentajes mayores que 0.9
  // como la condición ya retorna si se pinta o no, no hace falta el smoothstep, retornar 1 o 0.
  // const porcentaje = select(condicionPintar, 1.0, 0.0); (recomendación IA)

  const canal = mix(verde, vec3(1.0, 0.0, 0.0), porcentaje);

  return color(canal);
}

// Forma más óptima y escalable por IA: Según, al escalar el plano de referencia se 
function fragmentShaderPerlinIA() {
  /* 
  Al multiplicar por 4.0, divides el espacio de tu pantalla en 4 celdas independientes (de 0 a 1, de 1 a 2, de 2 a 3, y de 3 a 4).

  La función fract toma cada una de esas 4 celdas y las "aplana" localmente a un rango limpio de 0.0 a 1.0.

  Ya no le preguntas al píxel: "¿Estás en la coordenada global 0.25, 0.5, 0.75...?". En su lugar, cada celda interna calcula su propio nodo en el centro o en sus bordes locales de manera idéntica.
  */
  const verde = vec3(0.0, 1.0, 0.0);
  
  // 1. Escalar al número de divisiones (4 divisiones = saltos de 0.25)
  const gridCoord = uv().mul(4.0);
  
  // 2. Calcular la distancia de cada píxel al nodo entero más cercano
  // fract().sub(0.5) centra el espacio en cada nodo de la cuadrícula
  const distancia = length(fract(gridCoord.sub(0.5)).sub(0.5));

  // 3. Si la distancia es menor a un radio, es un nodo
  const esNodo = distancia.lessThan(0.1);

  // 4. Aplicar color directamente
  const porcentaje = select(esNodo, 1.0, 0.0);
  const canal = mix(verde, vec3(1.0, 0.0, 0.0), porcentaje);

  return color(canal);
}

// Utilizando fract(x): Si fract(x)=0.0 && fract(y)=0.0, pintar, ya que el punto está entre componentes enteras. (USANDO [0.0, 4.0])
function gridPoints() {

  // POR QUÉ NO CONTINUÉ USANDO ESTA APROXIMACIÓN:
  //mi código no sirve para perlin noise porque yo estaba tomando pocos puntos, en vez de todos los pixeles de la pantalla.
  // Este error se debió a que yo interpreté que cada gridpoint eran puntos selectos, pero no. Cada gridpoint corresponde a las esquinas de cada pixel.
  // Entonces perlin noise y el algoritmo se aplica a todos los pixeles.

  const fondo = vec3(0.0);
  const colorGridpoints = vec3(1.0, 0.0, 0.0);

  const coordsCeroCuatro = uv().mul(4.0); // [0.0, 4.1] Para el error de superior y derecha

  const fractXY = fract(coordsCeroCuatro); // obtener los puntos en componente entera de X,Y

  // pintar Puntos cercanos al módulo 0 de la unidad (cercanos a 1.0,2.0,3.0), y pintar los puntos cercanos a la derecha y superior (cercanos a 3.99) [4.0 es max]
  const gridpointsX = fractXY.x.lessThan(0.02).or(coordsCeroCuatro.x.greaterThanEqual(3.99));
  const gridpointsY = fractXY.y.lessThan(0.02).or(coordsCeroCuatro.y.greaterThanEqual(3.99));

  const condicionPintarXY = gridpointsX.and(gridpointsY);

  const porcentaje = select(condicionPintarXY, 1.0, 0.0);
  const canal = mix(fondo, colorGridpoints, porcentaje);

  // ASIGNAR VECTORES GRADIENTE CON FUNCIÓN HASH (si se pinta este vector gradiente en vez del canal, se ve que los pixeles son de cienta forma pintados aleatoriamente)
  const vectorGradiente = select(condicionPintarXY, obtenerGradiente(coordsCeroCuatro)); // Si el pixel actual es un nodo, llamar a la función y pasar las coordenadas del vector QUE CUMPLE ESA CONDICIÓN.

  // Por cada esquina (gridpoint), dibujar un vector desplazamiento al pixel actual. (hay que saber las coords de los gridpoints respecto al pixel actual)
  const coordenadasGridpointsCelda = vec4(...obtenerCoordenadasGridpointsCelda(coordsCeroCuatro));
  

  //const vectorDesplazamiento = 

  return color(canal);
}

// Funcion Propia :) (Ya no se usa por el malentendido de las gridpoints, pero la lógica de identificar las esquinas funciona)
function obtenerCoordenadasGridpointsCelda(coordenadasPixelActual) {
  // Se toma la coordenada del pixel actual, y se redondea a los próximos valores enteros en (x,y), sabiendo que los pixeles que son nodos(gridpoints), son enteros.
  const arrEsquinasCelda = [
    vec2(floor(coordenadasPixelActual.x), floor(coordenadasPixelActual.y)),
    vec2(ceil(coordenadasPixelActual.x), floor(coordenadasPixelActual.y)),
    vec2(floor(coordenadasPixelActual.x), ceil(coordenadasPixelActual.y)),
    vec2(ceil(coordenadasPixelActual.x), ceil(coordenadasPixelActual.y)) // o simplemente ceil(coordenadasPixelActual) 

  ]; // [abI, abD, arI, arD]

  return arrEsquinasCelda;
}

// Función hash pura para convertir coordenadas enteras en un vector gradiente (vec2: Debe abarcar los 4 cuadrantes, por eso de 2 dimensiones)
// Generada por IA
function obtenerGradiente(nodoEntero) {
  // Una fórmula hash clásica basada en seno para la GPU
  const n = sin(dot(nodoEntero, vec2(127.1, 311.7)));
  const aleatorio = fract(n.mul(43758.5453));
  
  // Convertimos el rango [0, 1] a direcciones [-1, 1] y normalizamos
  const angulo = aleatorio.mul(6.283185); // 2 * PI
  return vec2(cos(angulo), sin(angulo));
}

// Para animación en 3D, se utilizan vectores tridimensionales con Z=tiempo
function ruidoDePerlin() {

  // En general, se puede generar un patrón más extenso mientras mayor sea el plano de REFERENCIA.
  // Por lo que multiplicar los coordenadas por números más grandes, realiza lo anteriormente dicho.
  //const coordsCeroCuatro = uv().mul(14.0); // La variable se llama CeroCuatro por el caso base, pero generalizado, este puede medir lo que sea.
  
  // Si se quiere animar, se pueden desplazar las coordenadas de los píxeles en cualquier eje.
  const coordsCeroCuatro = uv().mul(14.0).add(vec2(time.mul(2.0), time.mul(2.0)));


  // Obtener las coordenadas de esquina de cada pixel
  const nodoAbI = vec2(floor(coordsCeroCuatro.x), floor(coordsCeroCuatro.y));
  const nodoAbD = vec2(ceil(coordsCeroCuatro.x), floor(coordsCeroCuatro.y));
  const nodoArI = vec2(floor(coordsCeroCuatro.x), ceil(coordsCeroCuatro.y));
  const nodoArD = vec2(ceil(coordsCeroCuatro.x), ceil(coordsCeroCuatro.y));

  // a cada esquina de ese pixel, asignar un vector gradiente pseudogenerado
  const gradAbI = obtenerGradiente(nodoAbI);
  const gradAbD = obtenerGradiente(nodoAbD);
  const gradArI = obtenerGradiente(nodoArI);
  const gradArD = obtenerGradiente(nodoArD);

  // 2. Obtener el Vector desplazamiento de cada esquina al pixel actual.
  const vectorDespAbI = coordsCeroCuatro.sub(nodoAbI);
  const vectorDespAbD = coordsCeroCuatro.sub(nodoAbD); // vectorDesp = (vecPixelActual - vecNodo), para que el vector resultante apunte del nodo al pixel.
  const vectorDespArI = coordsCeroCuatro.sub(nodoArI);
  const vectorDespArD = coordsCeroCuatro.sub(nodoArD);

  // Por cada esquina, calcular el producto punto entre el vector gradiente, y el vector desplazamiento.
  // Esto retorna 4 patrones/capas para generar el ruido de perlin.
  const prodPuntoAbI = dot(gradAbI, vectorDespAbI);
  const prodPuntoAbD = dot(gradAbD, vectorDespAbD);
  const prodPuntoArI = dot(gradArI, vectorDespArI);
  const prodPuntoArD = dot(gradArD, vectorDespArD); // Esto retorna 4 escalares por cada pixel, correspondiente a sus esquinas.


  // Como se escaló el plano [0.0, 4.0], y hay que retornar un brillo entre [0.0, 1.0], lo mejor es 'escalar las coordenadas de cada pixel a su propia celda'
  // donde celda 1 [0.0, 1.0], celda 2 (1.0. 2.0], ..., (3.0, 4.0].
  // Esto se puede hacer con fract(): Obtener la parte fraccionaria de las componentes de cada píxel, lo que hace que X,Y se limiten entre [0.0, 1.0).
  
  const coordsCeroCuatroLocalesALaCelda = fract(coordsCeroCuatro);
  const suavizado = smoothstep(0.0, 1.0, coordsCeroCuatroLocalesALaCelda);

  // Interpolar entre los productos punto en el eje X (todos los dotProd en la misma fila)
  // 4 puntos totales (de interpolar en X los 4 puntos, el resultado son 2):
  const blendHorizontalBajoPixel = mix(prodPuntoAbI, prodPuntoAbD, suavizado.x); // -> 2 puntos de abajo interpolados: resulta 1
  const blendHorizontalSobrePixel = mix(prodPuntoArI, prodPuntoArD, suavizado.x); // -> 2 puntos de arriba interpolados: resulta 1

  // Con los dos puntos resultantes de interpolar en X, se interpola en Y.
  const ruidoPerlin = mix(blendHorizontalBajoPixel, blendHorizontalSobrePixel, suavizado.y);

  return ruidoPerlin; // Oscila entre +-, ya que visualmente en Z desplaza vertices en sentido negativo.
}



// Printando el lienzo. (si aumentamos los 3 canales de 0.0 a 1.0, eventualmente alcanzará blanco)
materialPlano.colorNode = ruidoDePerlin();

// Si se requiere, eliminar para ver sólo en 2D.
// utilizamos Sólo las componentes 2D del vector tridimensional, para poder usar el ruido de perlin en cada uno de sus puntos en el espacio.
const posicionRuido = ruidoDePerlin();

materialPlano.positionNode = vec3(
  positionLocal.x,
  positionLocal.y,
  positionLocal.z.add(posicionRuido)
);






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

// Proyecto Perlin Noise - Creada para un futuro proyecto. :) - Jhz.