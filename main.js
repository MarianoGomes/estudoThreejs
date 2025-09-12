import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

//importando pós processamento
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GlitchPass } from "three/addons/postprocessing/GlitchPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { LuminosityShader } from "three/addons/shaders/LuminosityShader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SAOPass } from "three/addons/postprocessing/SAOPass.js";
//importando controle de camera
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { transformDirection } from "three/tsl";

//#region VARIAVEIS GERAIS
let inactivityTimer;
let isAnimating = false;
const inactivityDuration = 15000; // 30 segundos em milissegundos
const centroMapa = new THREE.Vector3(10, 0.3, 1.3); // O target inicial, pode ser a origem (0,0,0)
// Variaveis para as timelines do GSAP e os modelos carregados
let streetcarTimeline;
let streetcarModel;
let lightTimeline;
const lightControls = { angle: 0 };
const divRender = document.getElementById("janelaRender");
let boatModel;
let boatTimeline;
let mixer; // Variável para o AnimationMixer
const clock = new THREE.Clock(); // Relógio para o controle de tempo
const navegarButton = document.getElementById("navegar");
let isBoatAnimating = false;
//#endregion

//#region CRIANDO A CENA - no final tem que usar o render()

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75, //field of fiwe
  window.innerWidth / window.innerHeight, //aspect ratio
  0.1, //corte de elementos proximos
  1000 //corte de elementos distantes
);

scene.background = new THREE.Color(0x4682b4); // fundo da cena
const renderer = new THREE.WebGLRenderer({ antialias: true }); // A variável 'divRender' foi removida, pois ela não é um parâmetro válido.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
const canvas = renderer.domElement;
document.getElementById("janelaRender").appendChild(canvas);

// O código do pivô foi movido e corrigido para esta seção
const luzPivot = new THREE.Object3D();
luzPivot.rotation.x = -Math.PI / 4; // Inclina o pivô para simular a inclinação da Terra
luzPivot.position.copy(centroMapa);
scene.add(luzPivot);
//#endregion

//#region CARREGANDO UM CUBO NA CENA

// const geometry = new THREE.BoxGeometry(1, 1, 1);
// const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// const cube = new THREE.Mesh(geometry, material);
// cube.position.set(0, 0, 0);
// scene.add(cube);

scene.fog = new THREE.Fog(0x999999, 13, 60);
//#endregion

//#region CAMERA QUE SE MOVE - ORBITCONTROLS
camera.position.set(10, 1, 15); //lado, altura, profundidade
//camera.lookAt(20, 50, 50); //foco da camera, use apenas se nao tiver OrbitCOntrols na cena

const controls = new OrbitControls(camera, renderer.domElement);
// Opcional: Limitar o zoom da camera
controls.target.set(14, 1, -12);

controls.minDistance = 1;
controls.maxDistance = 20;
// Bloqueia a translação (movimento lateral) da câmera / zoom / rotacao
controls.enablePan = false;
// CONTROLA A CÂMERA DEPOIS DE CLICAR NO BOTÃO
controls.enabled = false;
// controls.enableZoom = false; // Bloqueia o zoom
// controls.enableRotate = false; // Bloqueia a rotação
const startButton = document.getElementById("startButton");
const backgroundMusic = document.getElementById("background-music");
const coverOverlay = document.getElementById("cover-overlay"); // NOVO: Obtenha a div de cobertura

//funçao para resetar contador da camera quando usario interage
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  isAnimating = false;
  inactivityTimer = setTimeout(startInactivityAnimation, inactivityDuration);
}

function startInactivityAnimation() {
  console.log("30 segundos de inatividade. Iniciando animação da câmera.");
  isAnimating = true;
}

//#endregion

//#region CARREGANDO MODELO 3D NA CENA
//#region CARREGANDO O CENARIO
const loader = new GLTFLoader();
//carregando o cenario
loader.load(
  "public/3dmodels/scene.gltf",
  function (gltf) {
    // 1. Adiciona o modelo à cena
    scene.add(gltf.scene);

    // 2. Percorre todos os sub-objetos do modelo
    gltf.scene.traverse(function (node) {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true; // Adicionada a verificação para garantir que o material seja compatível com luzes
        if (node.material.type === "MeshBasicMaterial") {
          node.material = new THREE.MeshStandardMaterial({
            color: node.material.color,
          });
        }
      }
    });
  },
  undefined,
  function (error) {
    console.error(error);
  }
);
//#endregion

//#region CARREGANDO O STREETCAR
const streetcar = new GLTFLoader();
streetcar.load(
  "public/3dmodels/streetcar.glb",

  // Função de sucesso
  function (gltf) {
    streetcarModel = gltf.scene;
    // --- CONFIGURAÇÃO INICIAL PARA A ANIMAÇÃO ---
    // 1. Defina a posição inicial
    streetcarModel = gltf.scene;
    streetcarModel.position.set(17.5, 2.6, -9);
    streetcarModel.rotation.y = 0;
    streetcarModel.scale.set(0.06, 0.06, 0.06);

    streetcarModel.traverse(function (child) {
      if (child.isMesh) {
        // Crie um novo material e copie todas as propriedades do original
        const originalMaterial = child.material;
        child.material = new THREE.MeshStandardMaterial();
        child.material.copy(originalMaterial); // Habilite a transparência e defina a opacidade inicial

        child.material.transparent = true;
        child.material.opacity = 0; // Habilite as sombras

        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(streetcarModel);
    const opacity = { value: 0 };

    // Crie a timeline e PAUSE-A INICIALMENTE
    streetcarTimeline = gsap.timeline({
      repeat: -1,
      yoyo: false,
      paused: true,
      defaults: {
        ease: "power1.inOut",
        duration: 1,
      },
    });

    // 1. ANIMAÇÃO DE FADE-IN
    streetcarTimeline.to(opacity, {
      value: 1,
      duration: 1,
      onUpdate: () => {
        streetcarModel.traverse(function (child) {
          if (child.isMesh) {
            child.material.opacity = opacity.value;
          }
        });
      },
    });

    // 2. ANIMAÇÃO DE MOVIMENTO
    streetcarTimeline.to(
      streetcarModel.position,
      {
        z: 11,
        duration: 8,
        ease: "linear",
      },
      "<"
    );

    // 3. ANIMAÇÃO DE FADE-OUT
    streetcarTimeline.to(
      opacity,
      {
        value: 0,
        duration: 1,
        onUpdate: () => {
          streetcarModel.traverse(function (child) {
            if (child.isMesh) {
              child.material.opacity = opacity.value;
            }
          });
        },
      },
      "-=1"
    );

    console.log("Animação do trem configurada e pausada.");
  },
  undefined,
  function (error) {
    console.error(error);
  }
);
//#endregion

//#region  FUNÇÃO PARA CARREGAR E ANIMAR O BARCO
function createAndAnimateBoat() {
  if (isBoatAnimating) {
    return; // Impede que a função seja chamada novamente se a animação já estiver em andamento
  }

  isBoatAnimating = true; // Inicia a animação

  // Carrega o modelo do barco
  const boat = new GLTFLoader();
  boat.load(
    "public/3dmodels/Yatch.glb",
    function (gltf) {
      boatModel = gltf.scene;

      // 1. Configurações iniciais
      boatModel.position.set(7.75, -0.8, 11); // Posição de início (na água, no lado oposto do bondinho)
      // Inverte a rotação para virar para o lado certo
      boatModel.scale.set(3, 3, 3);
      // Cria o mixer para o modelo
      mixer = new THREE.AnimationMixer(boatModel);
      // Pega o primeiro clipe de animação do modelo
      const clip = gltf.animations[0];
      if (clip) {
        // Cria uma ação a partir do clipe e a inicia
        const action = mixer.clipAction(clip);
        action.play();
        console.log("Animação do barco iniciada.");
      } else {
        console.warn("Nenhuma animação encontrada no modelo do barco.");
      }

      // 2. Habilita sombras e transparências
      boatModel.traverse(function (node) {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.material.transparent = true;
          node.material.opacity = 0; // Começa transparente
        }
      });

      scene.add(boatModel);

      // 3. Cria a timeline GSAP para a animação do barco
      const boatOpacity = { value: 0 };
      boatTimeline = gsap.timeline({
        paused: false, // Inicia a animação imediatamente
        onComplete: () => {
          // Quando a animação termina:
          scene.remove(boatModel); // Remove o barco da cena
          isBoatAnimating = false; // Permite um novo clique
          navegarButton.disabled = false; // Reabilita o botão
          navegarButton.textContent = "Navegar"; // Volta o texto do botão
          if (mixer) {
            mixer.stopAllAction();
          }
        },
      });

      // 3.1. Fade-in
      boatTimeline.to(boatOpacity, {
        value: 1,
        duration: 1,
        onUpdate: () => {
          boatModel.traverse(function (child) {
            if (child.isMesh) {
              child.material.opacity = boatOpacity.value;
            }
          });
        },
      });

      // 3.2. Movimento
      boatTimeline.to(
        boatModel.position,
        {
          z: -9, // Move para a posição final (sentido inverso do bondinho)
          duration: 4, // 4 segundos de movimento
          ease: "linear",
        },
        "<" // Inicia a animação de movimento ao mesmo tempo que a de fade-in
      );

      // 3.3. Fade-out no final
      boatTimeline.to(
        boatOpacity,
        {
          value: 0,
          duration: 1, // 1 segundo para o fade-out
          onUpdate: () => {
            boatModel.traverse(function (child) {
              if (child.isMesh) {
                child.material.opacity = boatOpacity.value;
              }
            });
          },
        },
        "-=0.5" // Começa o fade-out 0.5s antes do final da animação de movimento
      );
    },
    undefined,
    function (error) {
      console.error(error);
      isBoatAnimating = false;
      navegarButton.disabled = false;
      navegarButton.textContent = "Navegar";
    }
  );
}
//#endregion
//#endregion

//#region CARREGANDO FONTE DE LUZ
const corDaLuz = 0xffffff; // Branco
const intensidadeDaLuz = 1; // 1 é o valor padrão

const luzDoSol = new THREE.DirectionalLight(corDaLuz, intensidadeDaLuz);
luzDoSol.castShadow = true;
luzDoSol.position.set(0, 0, 50); // Posição inicial (em relação ao pivô)
luzDoSol.shadow.mapSize.width = 1024 * 4; // Aumentado
luzDoSol.shadow.mapSize.height = 1024 * 4; // Aumentado
// O alvo da luz é definido para o centro do mapa
luzDoSol.target.position.copy(centroMapa);
luzDoSol.shadow.camera.far = 150; // O 'far' foi aumentado para cobrir uma área maior
luzDoSol.shadow.camera.left = -50; // As dimensões da câmera de sombra foram ampliadas
luzDoSol.shadow.camera.right = 50;
luzDoSol.shadow.camera.top = 50;
luzDoSol.shadow.camera.bottom = -50;

const luzAmbiente = new THREE.AmbientLight(0x0c315e, 1);
luzAmbiente.lookAt(-1000, 0, 0);

// Aqui está a linha de correção mais importante:
luzPivot.add(luzDoSol); // A luz agora é um "filho" do pivô

scene.add(luzDoSol.target); // O target precisa estar na cena para que a luz saiba para onde apontar
scene.add(luzAmbiente);
//#endregion

//#region ELEMENTOS DE PÓS PROCESSAMENTO
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.105,
  0.5,
  0.1
);
composer.addPass(bloomPass);
//#endregion

//#region BOTAO 3D NA CENA
const buttons = [];

const geometry1 = new THREE.BoxGeometry(1, 1, 1);
const button1 = new THREE.Mesh(
  geometry1,
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
button1.position.set(5.5, 0.3, 7);
button1.userData.name = "Botão Caixa";
button1.castShadow = true;
scene.add(button1);
buttons.push(button1);

const geometry2 = new THREE.SphereGeometry(1);
const button2 = new THREE.Mesh(
  geometry2,
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
button2.position.set(8, 8, -7);
button2.userData.name = "Botão Sphere";
button2.castShadow = true;
scene.add(button2);
buttons.push(button2);

const geometry3 = new THREE.ConeGeometry(1, 2, 16);
const button3 = new THREE.Mesh(
  geometry3,
  new THREE.MeshBasicMaterial({ color: 0x0000ff })
);
button3.position.set(15.5, 3.5, -2);
button3.userData.name = "Botão Cone";
button3.castShadow = true;
scene.add(button3);
buttons.push(button3);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// NOVO: Variável de controle para o estado da experiência
let isExperienceStarted = false;

window.addEventListener("mousedown", onMouseClick, false);

const infoBox = document.getElementById("info-box");
const infoText = document.getElementById("info-text");
function onMouseClick(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(buttons);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    console.log("Você clicou no:", clickedObject.userData.name);

    // APENAS FOCA SE A EXPERIÊNCIA JÁ TIVER COMEÇADO
    if (isExperienceStarted) {
      focusOnObject(clickedObject);
    }

    // ----------------------------------------------------
    // Lógica para exibir a caixa de informações
    // ----------------------------------------------------

    // 1. Atualiza o texto da caixa de informações
    infoText.textContent = clickedObject.userData.name;

    // 2. Converte a posição 3D do objeto para uma posição 2D na tela
    const vector = new THREE.Vector3();
    clickedObject.getWorldPosition(vector);
    vector.project(camera);

    // 3. Calcula as coordenadas do canvas
    const x = (vector.x * 0.5 + 0.5) * rect.width;
    const y = (-vector.y * 0.5 + 0.5) * rect.height;

    // 4. Posiciona a caixa de informações e a exibe
    // Adiciona um pequeno "offset" para que a caixa não fique em cima do objeto.
    infoBox.style.display = "block";
    infoBox.style.left = `${x + 20}px`; // Ajuste o 20 para o lado do objeto
    infoBox.style.top = `${y}px`;
  } else {
    // Esconde a caixa de informações se não houver clique em um botão
    infoBox.style.display = "none";
  }
}

// Essa função será chamada tanto no start quanto nos botões 3D
function focusOnObject(object) {
  const targetPosition = object.position.clone();
  targetPosition.x += 1;
  targetPosition.y += 1;
  targetPosition.z += 2;

  gsap.to(camera.position, {
    duration: 1.5,
    x: targetPosition.x,
    y: targetPosition.y,
    z: targetPosition.z,
    ease: "power2.inOut",
    onUpdate: () => {
      controls.target.copy(object.position);
    },
  });

  gsap.to(controls.target, {
    duration: 1.5,
    x: object.position.x + 0.6,
    y: object.position.y + 0.2,
    z: object.position.z,
    ease: "power2.inOut",
  });
}
//#endregion

//#region EVENTO DE CLIQUE EM GERAL

//animaçoes do botao Iniciar
startButton.addEventListener("mouseenter", () => {
  // ANIMAÇÃO DE HOVER: quando o mouse entra no botão, a máscara se expande
  if (!isExperienceStarted) {
    gsap.to(coverOverlay, {
      // Expande a máscara para cobrir toda a tela
      scale: 1.3,
      duration: 0.4, // Duração da expansão
      ease: "power2.inOut",
    });
  }
});

// ANIMAÇÃO DE HOVER: quando o mouse sai do botão, a máscara volta ao tamanho original
startButton.addEventListener("mouseleave", () => {
  if (!isExperienceStarted) {
    gsap.to(coverOverlay, {
      scale: 1,
      duration: 1,
      ease: "power2.inOut",
    });
  }
});

startButton.addEventListener("click", () => {
  // Tenta reproduzir a música
  backgroundMusic.volume = 0.5;
  backgroundMusic
    .play()
    .then(() => {
      // HABILITA A VARIÁVEL DE ESTADO
      isExperienceStarted = true;
      // Animação da opacidade do botao Começar
      gsap.to(startButton, {
        opacity: 0,
        duration: 1,
        onComplete: () => {
          // Esconde o botão após a animação de opacidade
          startButton.style.display = "none";

          // ANIMA A CÂMERA PARA A NOVA POSIÇÃO
          gsap.to(camera.position, {
            duration: 2,
            x: 0,
            y: 8,
            z: 10,
            ease: "power2.inOut",
          });
          // ANIMA O FOCO DA CÂMERA (o controls.target)
          gsap.to(controls.target, {
            duration: 2,
            x: centroMapa.x,
            y: centroMapa.y,
            z: centroMapa.z,
            ease: "power2.inOut",
            onComplete: () => {
              // Só habilita o controle da câmera após a animação terminar
              controls.enabled = true;
            },
          });
          // INICIA A ANIMAÇÃO DO TREM
          if (streetcarTimeline) {
            streetcarTimeline.play();
          }
          // INICIA A ANIMAÇÃO DA LUZ
          if (lightTimeline) {
            lightTimeline.play();
          }

          resetInactivityTimer();

          // Adicione estes event listeners para detectar a interação do usuário
          window.addEventListener("mousemove", resetInactivityTimer);
          window.addEventListener("mousedown", resetInactivityTimer);
          window.addEventListener("touchstart", resetInactivityTimer);
        },
      });
      // Animação da opacidade e scale da overlay
      gsap.to(coverOverlay, {
        opacity: 1,
        scale: 9,
        duration: 2,
        ease: "power2.inOut",
        onComplete: () => {
          coverOverlay.style.display = "none";
        },
      });
    })
    .catch((error) => {
      console.error("Erro ao reproduzir a música:", error);
    });
});

//animaçao da lancha
navegarButton.addEventListener("click", () => {
  navegarButton.disabled = true; // Desabilita o botão
  navegarButton.textContent = "Navegando..."; // Altera o texto do botão
  createAndAnimateBoat(); // Chama a função que carrega e anima o barco
});
//#endregion

//-------------------------- GERANDO A CENA
// Variáveis para a rotação da luz
const radius = 50;
const y = 100;

// Defina as novas cores para o ciclo do dia
const corMadrugada = new THREE.Color(0x0b0c10);
const corAmanhecer = new THREE.Color(0xffd580);
const corManha = new THREE.Color(0x87ceeb);
const corMeioDia = new THREE.Color(0x4682b4);
const corTarde = new THREE.Color(0xff8c42);
const corAnoitecer = new THREE.Color(0x010e39);

// CRIE UMA TIMELINE PARA A ANIMAÇÃO DA LUZ E PAUSE-A
// Alterado na linha 293: Reescrevendo a timeline para ser contínua.
lightTimeline = gsap.timeline({
  repeat: -1, // Repete a animação infinitamente
  paused: true, // Começa pausada
  ease: "none", // Mantém uma velocidade constante
  duration: 24, // Duração de 24 segundos
});

// Alterado na linha 299: Adicione um tween para a rotação constante do ângulo
lightTimeline.to(
  luzPivot.rotation, // Anima a rotação do pivô
  {
    y: Math.PI * 2, // Uma volta completa no eixo Y (sentido horizontal)
    duration: 24, // Duração de 24 segundos
    ease: "none",
  },
  0
);

// Alterado na linha 306: Adicione um tween para a transição suave de cores do fundo da cena
lightTimeline.to(
  scene.background,
  {
    // Use 'keyframes' para definir os pontos de transição de cor
    keyframes: [
      { r: corMeioDia.r, g: corMeioDia.g, b: corMeioDia.b, ease: "none" }, // 0% - Meio-dia (início)
      { r: corTarde.r, g: corTarde.g, b: corTarde.b, ease: "none" }, // 20% - Tarde
      { r: corAnoitecer.r, g: corAnoitecer.g, b: corAnoitecer.b, ease: "none" }, // 40% - Anoitecer
      { r: corMadrugada.r, g: corMadrugada.g, b: corMadrugada.b, ease: "none" }, // 60% - Madrugada (noite mais escura)
      { r: corAmanhecer.r, g: corAmanhecer.g, b: corAmanhecer.b, ease: "none" }, // 80% - Amanhecer
      { r: corManha.r, g: corManha.g, b: corManha.b, ease: "none" }, // 100% - Manhã
      // O último keyframe é o mesmo que o primeiro para fechar o ciclo suavemente
      { r: corMeioDia.r, g: corMeioDia.g, b: corMeioDia.b, ease: "none" }, // Continua para o Meio-dia
    ],
    duration: 24,
  },
  0
);

function animate() {
  //anima o barco
  const delta = clock.getDelta(); // Obtém o tempo decorrido desde o último frame
  if (mixer) {
    mixer.update(delta); // Atualiza o mixer com o tempo decorrido
  }

  if (isAnimating) {
    const rotationSpeed = 0.0001;
    const radius = 20;

    const time = performance.now() * rotationSpeed;
    camera.position.x = centroMapa.x + Math.cos(time) * radius;
    camera.position.y = centroMapa.y + 3;
    camera.position.z = centroMapa.z + Math.sin(time) * radius;
    camera.lookAt(centroMapa);
  }
  const globalLightPosition = new THREE.Vector3();
  luzDoSol.getWorldPosition(globalLightPosition);

  // Defina os valores de intensidade máxima e mínima
  const maxIntensity = 1.0;
  const minIntensity = 0.2;

  // Mapeia a posição Y da luz para uma escala de 0 a 1
  const lightY = globalLightPosition.y;
  const t = Math.max(0, lightY / 50);

  // Ajusta a intensidade com base na altura da luz
  if (lightY > 0) {
    // Aumenta a intensidade quando a luz está acima do horizonte
    luzDoSol.intensity = minIntensity + (maxIntensity - minIntensity) * (t * t);
  } else {
    // Diminui para a intensidade mínima quando a luz está abaixo do horizonte
    luzDoSol.intensity = minIntensity;
  }
  luzDoSol.lookAt(centroMapa);
  controls.update();
  renderer.render(scene, camera);
  composer.render();
}
renderer.setAnimationLoop(animate);
