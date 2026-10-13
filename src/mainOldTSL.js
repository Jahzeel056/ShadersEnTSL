import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Utilizando TSL
import { color, sin, time, uv, mix, positionLocal, vec3, uniform, distance, lessThanEqual, select } from 'three/tsl';

// Definir escena
const scene = new THREE.Scene();
// El color de la escena es blanco por defecto al usar WebGPURenderer, así que lo puedo cambiar a negro.
//scene.background = new THREE.Color('black');
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

// Configuración del Canva y renderer (dimensiones en las que renderiza)
const renderer = new THREE.WebGPURenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometriaCubo = new THREE.BoxGeometry(1, 1, 1);

const geometriaPlano = new THREE.PlaneGeometry(3, 3, 20, 23);

const materialPlano = new THREE.MeshStandardNodeMaterial({
  //color: 'green',
  //wireframe: true
});
// Plano con doble cara para que interactúe con luz de ambos lados
materialPlano.side = THREE.DoubleSide;

// Utilizando TSL (Prueba)

const materialCubo = new THREE.MeshStandardNodeMaterial({
  wireframe: false
});
// Ajusta el color a azul y modifica el color según el tiempo desde 0(negro) a 1(brillante). 
// (como seno retorna -1/1, multiplicar por 0.5 lo deja en -0.5 a 0.5, y sumar 0.5 lo deja de 0 a 1)
// FINALMENTE: Multiplica el color base por el resultado del seno y demás. (resulta en el apagado y encendido del color)
//const ondaTransicion = mix(color)
materialCubo.colorNode = color( 0x00aaff ).mix( color(0xff0000), sin(time).mul(0.5).add(0.5)); // No uso color node, porque quiero que el color siempre se interpole, no que cambie de la nada.

/*
  Rugosidad DINÁMICA mediante el .roughnessNode [propiedad de tipo nodo para usar con TSL]
  uv() mapea la geometría de cada cara del cubo de 0(parte inferior) a 1(parte superior).
  Como se indicó en el roughnessNode que la rugosidad cambia con la altura mapeada en 2D [eje Y] (uv().y), el 
  resultado es que las partes superiores del cubo son más opacas (roughness 1) y las más bajas son más similares a un espejo 
  (roughness 0))
*/
materialCubo.roughnessNode = uv().y;
materialCubo.metalness = 0.8;
// Reescrito con mix sin encadenar (Prueba de la modularidad de TSL para reescribir los shaders de diversas formas)
//materialCubo.colorNode = mix(color(0x00aaf), color(0xff0000), sin(time).mul(0.5).add(0.5));

// Incluso, se puede escribir código más limpio y modular de la siguiente forma:
/* 
const ondaColor = sin( time ).mul( 0.5 ).add( 0.5 );
materialCubo.colorNode = color( 0x00aaff ).mul( ondaColor );
*/

// Otro ejemplo que cambia solo iluminación de color
//materialCubo.colorNode = color( 0x00aaff ).mul( sin( time ).mul( 0.5 ).add( 0.5 ) );

/* Modificando el Position Node */
materialCubo.positionNode = vec3(
  positionLocal.x,
  positionLocal.y.mul(sin(time).mul(0.5).add(0.5)),
  positionLocal.z
)
console.log(materialCubo.positionNode)




/* Iluminación */

// AmbientLight (Igual en todas partes)

const luzAmbiente = new THREE.AmbientLight('white', 0.5);
scene.add(luzAmbiente);


// Luz direccional (Con focus en una parte del espacio)
const luzPuntual = new THREE.PointLight('white', 10, 10)
scene.add(luzPuntual);
luzPuntual.position.set(2, 0, 2);

const meshCubo = new THREE.Mesh(geometriaCubo, materialCubo);
const meshPlano = new THREE.Mesh(geometriaPlano, materialPlano);
meshPlano.position.z = 3;

// Al movimiento en Z, se le multiplica la distancia que recorrerá cada vertice (una máscara de pesos)
const weightMask = uv().y;
const frecuencia = 10;
const velocidad = 3;

// Onduleando plano
//materialPlano.positionNode = vec3(
//  positionLocal.x,
//  positionLocal.y,
  // Un plano TIENE COORDENADA Z=0 ya que no tiene depth. Por eso, hay que desplazarlo con sumas, no directamente multiplicar un seno, porque 0*algo=0
  // ejemplo: positionLocal.z.add(sin(time).mul(0.5).add(0.5))

  /*
  Para crear este efecto de onda, se mumeven los vértices 'Desfasados según la posición'.
  ¿Cómo sabemos la posición? Podemos usar el mapeo UV que va de 0 a 1, los números de por medio permitirán desfasar.
  uv().y.mul(frecuencia): En las partes más bajas, la frecuencia (termina siendo la fase) es menor -> 0*10 = 0 [pero se le resta la fase (termina siendo la frecunencia), no queda en 0]
  .sub(time.mul())
  */
  
  // desplazamiento espacial de una onda hacia adelante cuando una variable crece en el tiempo: h(t-Tau) [ESTE ES EL PRINCIPIO DE DESPLAZAMIENTO EXPLICADO]
  // Equivalencia con ecuación general Seno:
  /* 
  = A * Sin( wt + fase )
  = 2 * Sin( (uv().y)*f - velocidad*t )
  REORDENANDO
  = 2 * Sin( - (velocidad*t) + (uv().y)*f )  ||<<---- Por más que la frec se multiplique por el UV, el resultado es la fase.
  = 2 * Sin( -wt + fase ) 
  */
//  positionLocal.z.add( sin( uv().y.mul( frecuencia ).sub( time.mul( velocidad ) ) ) ).mul(0.1) 
//);

scene.add(meshCubo);
scene.add(meshPlano);

// Experimentando con el color de los nodos MEDIANTE UN UNIFORM [PORQUE LO QUIERO VARIAR CONSTANTEMENTE]
const colorUniformePlano = uniform( new THREE.Color(0xababff) );
//materialPlano.colorNode = colorUniformePlano;
// Así se accede al color/valor que almaena el UNIFORM
console.log(colorUniformePlano.value);

// Modificando el brillo mediante mapeo UV (ESTE MISMO SHADER LO PUEDO REUTILIZAR EN CUALQUIER CAMBIO DE colorNode)
const shaderBrilloUV = uv().y.mul(colorUniformePlano);


// Creando un shader experimental para intentar idear el ondeo [Migrar a otro proyecto para tener orden]
const shaderOndeo = uv().y.mul(colorUniformePlano).mul(uv().x)


// Leyendo el mouse para Mapear coordenadas de viewport [0, 1] a coordenadas GPU [-1, 1]
const mouse = new THREE.Vector2(-10, -10); // Si iniciara en (0,0), el rayCaster iniciaría emitiendo un rayo al centro en la escena

window.addEventListener('mousemove', (e) => {
  //console.log(e.clientX, e.clientY)
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;

  //console.log(mouse);
})

/* 
Para saber con qué objeto 3D colisiona el click (dicho vágamente, pero explicado en el markdown),
se uiliza un rayCaster, que depende del mapeo [-1, 1] que retorna 'mouse'. 
-RECORDAR QUE ESE MAPEO ESTÁ ADAPTADO SÓLO CUANDO EL CANVAS TIENE LAS MISMAS DIMENSIONES QUE EL VIEWPORT.-
*/
// RAYCAST (Se actualiza en cada frame, ya que hay que verificar constantemente si el mouse(rayo) intersecta a un objeto)
const raycaster = new THREE.Raycaster();

// Rastrear coordenada uv de impacto, actualizada desde el loop
const uvMouseUniformChoque = uniform( new THREE.Vector2(-10,-10) );

// 'Si la distancia del punto procesado al punto del mouse en hover es menor que [...], colorear'
const condicionPintar = distance( uv(), uvMouseUniformChoque ).lessThanEqual(0.05);

// Utilizando un condicional ternario de TSL (el IF/ELSE es más complicado en estructura)
materialPlano.colorNode = select( condicionPintar, color(0xff0000), shaderOndeo);
// Nota: Si el mouse deja el objeto, el UNIFORM permanecerá ena última posición, dejando el círculo rojo. Se puede setear el uniform a un valor grande para evitar esto, que rompa el true.



// Configurar cámara antes de renderizar
camera.position.z = 6;
camera.lookAt(0, 0, 0);

// Configurar controles de Órbita y Ejes
const controles = new OrbitControls(camera, renderer.domElement);
controles.target.copy(meshPlano.position);
const ejes = new THREE.AxesHelper(7, 7, 7);
scene.add(ejes);

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
  meshCubo.rotation.y += 0.01;
  //x=r*sin(t), z=r*cos(t) | plano polar
  let elapsed = reloj.getElapsed();
  // Rotando la pointlight porque si (recordando XD)
  luzPuntual.position.x = 2*Math.sin(elapsed);
  luzPuntual.position.z = 2*Math.cos(elapsed);

  // RayCasting //

  // Indicar origen y dirección del siguiente rayo a emitir
  raycaster.setFromCamera(mouse, camera); // Desde la posición normalizada del mouse (dirección), y desde la cámara (origen del rayo)

  // Obtener resultados del raycasting (Luego de ser emitido, este retorna un array de puntos intersectados, siendo el primero, el primer intersecto)
  console.log(raycaster.intersectObject(meshPlano)); // el argumento debe ser el objeto a verificar si se intersectó.

  const intersecciones = raycaster.intersectObject(meshPlano); // Retorna un array, visto en consola

  // si se detectó almenos una intersección con el objeto
  if (intersecciones.length > 0) {
    // Obtener el primer punto de intersección (para este caso), que es el primer elemento
    const puntoChoque = intersecciones[0].point; // 3D coords
    const parteChoque = intersecciones[0].uv;

    // Actualizar uniforme para que almacene el punto del plano donde se colocó el cursor
    uvMouseUniformChoque.value.copy(parteChoque);

    //console.log(`PuntoChoque: XYZ(${puntoChoque.x}, ${puntoChoque.y}, ${puntoChoque.z})`);
    console.log(parteChoque, uvMouseUniformChoque);
    // Cambiar el color del vértice en ese punto
    //materialPlano.colorNode = u

  }

}

// Animar renderizado (continuo)
renderer.setAnimationLoop(animate);
