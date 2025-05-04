import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const towerCollisionGroup = 1;
const pendulumCollisionGroup = 0;
const pendulumBlockHeightOffset = 3;

class Vector3 {
  x: number = 0;
  y: number = 0;
  z: number = 0;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class PhysicsObject {
  mesh: THREE.Mesh;
  body: CANNON.Body;

  constructor(x: number, y: number, z: number, color: number, world: CANNON.World, position: Vector3, collisionGroup: number = 0) {
    const geometry = new THREE.BoxGeometry(x, y, z);
    const material = new THREE.MeshStandardMaterial({ color });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(position.x, position.y, position.z);

    const shape = new CANNON.Box(new CANNON.Vec3(x / 2, y / 2, z / 2));
    this.body = new CANNON.Body({
      mass: 0,
      shape,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      collisionFilterGroup: collisionGroup
    });
    world.addBody(this.body);
  }
}

class TowerBlock extends PhysicsObject {
  angle: number = 0;
  speed: number = 0.02;
  maxAngle: number = Math.PI / 6;

  addToScene(scene: THREE.Scene) {
    scene.add(this.mesh);
  }

  movePendulum(newY: number) {
    this.angle += this.speed;
    const swayX = Math.sin(this.angle) * 10;
    this.mesh.position.set(swayX, newY, 0);
    this.body.position.set(swayX, newY, 0);
  }

  activatePhysicsBody() {
    this.speed = 0;
    this.body.collisionFilterGroup = towerCollisionGroup;
    this.body.mass = 1;
    this.body.type = CANNON.Body.DYNAMIC;
    this.body.updateMassProperties();
  }

  deleteBlock(scene: THREE.Scene, world: CANNON.World) {
    this.mesh.geometry.dispose();
    world.removeBody(this.body);
    scene.remove(this.mesh);
  }

  updatePhysics() {
    this.mesh.position.copy(this.body.position as unknown as THREE.Vector3);
    this.mesh.quaternion.copy(this.body.quaternion as unknown as THREE.Quaternion);
  }
}

class TowerGame {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  world: CANNON.World;

  blockSize: Vector3 = { x: 5, y: 1, z: 5 };
  blockColors: number[] = [0xff0000, 0x008000, 0x0000ff, 0xffff00];
  blocksUntilChangeColor: number = 5;

  towerHeight: number = 0;
  currentColor: number = 0xffffff
  blockIndex: number = 0;
  blocks: TowerBlock[] = [];
  currentBlock: TowerBlock | null = null;

  score = 0;
  scoreElement: HTMLDivElement;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 20, 30);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

    this.setupLighting();
    this.createBaseBlock();

    this.currentColor = this.getRandomBlockColor();
    this.currentBlock = this.createPendulumBlock();

    this.scoreElement = document.createElement('div');
    this.scoreElement.style.position = 'absolute';
    this.scoreElement.style.top = '10px';
    this.scoreElement.style.left = '10px';
    this.scoreElement.style.color = 'black';
    this.scoreElement.style.fontSize = '24px';
    this.scoreElement.style.fontFamily = 'Arial';
    document.body.appendChild(this.scoreElement);
    this.updateScoreDisplay();

    this.animate();
    this.addEventListeners();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
  }

  createBaseBlock() {
    let position : Vector3 = new Vector3(0, this.towerHeight, 0);
    const base = new TowerBlock(this.blockSize.x, this.blockSize.y, this.blockSize.z, 0x888888, this.world, position, towerCollisionGroup);
    base.addToScene(this.scene);
    this.blocks.push(base);
  }

  createPendulumBlock(): TowerBlock {
    let position : Vector3 = new Vector3(0, this.towerHeight + (this.blockSize.y * pendulumBlockHeightOffset), 0);
    const block = new TowerBlock(this.blockSize.x, this.blockSize.y, this.blockSize.z, this.currentColor, this.world, position, pendulumCollisionGroup);
    block.addToScene(this.scene);
    return block;
  }

  dropBlock() {
    if (!this.currentBlock) return;

    const topBlock = this.blocks[this.blocks.length - 1];
    const deltaX = this.currentBlock.mesh.position.x - topBlock.mesh.position.x;
    this.currentBlock.activatePhysicsBody();

    const alignment = Math.abs(deltaX);
    if (alignment < 0.5) {
      this.score += 10;
      this.currentBlock.mesh.position.set(topBlock.mesh.position.x, this.currentBlock.mesh.position.y, topBlock.mesh.position.z)
      this.currentBlock.body.position.set(topBlock.mesh.position.x, this.currentBlock.mesh.position.y, topBlock.mesh.position.z)
    } else if (alignment < 2) {
      this.score += 5;
    } else {
      this.score += 1;
    }
    this.updateScoreDisplay();

    this.blockIndex += 1;
    if (this.blockIndex % this.blocksUntilChangeColor == 0)
    {
      this.currentColor = this.getRandomBlockColor();
    }

    this.towerHeight += this.blockSize.y;
    this.blocks.push(this.currentBlock);

    this.currentBlock = this.createPendulumBlock();
  }

  getRandomBlockColor() : number {
    const randomIndex = Math.floor(Math.random() * this.blockColors.length);
    return this.blockColors[randomIndex];
  }

  updateScoreDisplay() {
    this.scoreElement.innerText = `Score: ${this.score}`;
  }

  addEventListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.dropBlock();
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('click', () => {
      this.dropBlock();
    });
  }

  updateBlocks() {
    for (const block of this.blocks) {
      block.updatePhysics();

      if (block.mesh.position.y <= -10)
      {
        this.deleteBlock(block);
      }
    }
  }

  deleteBlock(block: TowerBlock)
  {
    block.deleteBlock(this.scene, this.world);

    const indexOfBlock = this.blocks.indexOf(block, 0); 
    delete this.blocks[indexOfBlock];
    this.blocks.splice(indexOfBlock, 1);

    this.towerHeight -= this.blockSize.y;

    this.score -= 5;
    this.updateScoreDisplay();
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    this.world.step(1 / 60);

    if (this.currentBlock) {
      this.currentBlock.movePendulum(this.towerHeight + (this.blockSize.y * pendulumBlockHeightOffset));
    }

    this.updateBlocks();

    this.renderer.render(this.scene, this.camera);
  };
}

new TowerGame();