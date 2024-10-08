import { vec3, quat2, mat4 } from "gl-matrix"

export default class Camera {
  static MODE_THIRDPERSON = 1
  static MODE_FLY = 2

  constructor(state) {
    this.state = state

    this.position = vec3.create()
    this.quaternion = quat2.create()
    this.mode = Camera.MODE_THIRDPERSON

    this.thirdPerson = new CameraThirdPerson(state)
    this.fly = new CameraFly(state)

    // Activate
    if (this.mode === Camera.MODE_THIRDPERSON)
      this.thirdPerson.activate()

    else if (this.mode === Camera.MODE_FLY)
      this.fly.activate()

    this.state.controls.on('cameraModeDown', () => {
      if (this.mode === Camera.MODE_THIRDPERSON) {
        this.mode = Camera.MODE_FLY
        this.fly.activate(this.position, this.quaternion)
        this.thirdPerson.deactivate()
      }

      else if (this.mode === Camera.MODE_FLY) {
        this.mode = Camera.MODE_THIRDPERSON
        this.fly.deactivate()
        this.thirdPerson.activate()
      }
    })

    this.setDebug()
  }

  update() {

    switch (this.mode) {
      case Camera.MODE_THIRDPERSON:
        this.thirdPerson.update()
        vec3.copy(this.position, this.thirdPerson.position)
        quat2.copy(this.quaternion, this.thirdPerson.quaternion)
        break
      case Camera.MODE_FLY:
        this.fly.update()
        vec3.copy(this.position, this.fly.position)
        quat2.copy(this.quaternion, this.fly.quaternion)
        break
    }

  }

  setDebug() {
    const debug = this.state.debug
    if (!debug.gui)
      return

    const folder = debug.getFolder('state/player')

    folder
      .add(
        this,
        'mode',
        {
          'MODE_THIRDPERSON': Camera.MODE_THIRDPERSON,
          'MODE_FLY': Camera.MODE_FLY
        }
      )
      .onChange(() => {
        if (this.mode === Camera.MODE_THIRDPERSON) {
          this.fly.deactivate()
          this.thirdPerson.activate()
        }

        else if (this.mode === Camera.MODE_FLY) {
          this.fly.activate(this.position, this.quaternion)
          this.thirdPerson.deactivate()
        }
      })
  }
}

export class CameraFly {
  constructor(state) {
    this.state = state

    this.active = false

    this.gameUp = vec3.fromValues(0, 1, 0)

    this.defaultForward = vec3.fromValues(0, 0, 1)

    this.forward = vec3.clone(this.defaultForward)
    this.rightward = vec3.create()
    this.upward = vec3.create()
    this.backward = vec3.create()
    this.leftward = vec3.create()
    this.downward = vec3.create()

    vec3.cross(this.rightward, this.gameUp, this.forward)
    vec3.cross(this.upward, this.forward, this.rightward)
    vec3.negate(this.backward, this.forward)
    vec3.negate(this.leftward, this.rightward)
    vec3.negate(this.downward, this.upward)

    this.position = vec3.fromValues(40, 10, 40)
    this.quaternion = quat2.create()
    this.rotateX = - Math.PI * 0.15
    this.rotateY = Math.PI * 0.25
    this.rotateXLimits = { min: - Math.PI * 0.5, max: Math.PI * 0.5 }
  }

  activate(position = null, quaternion = null) {
    this.active = true

    if (position !== null && quaternion !== null) {
      // Position
      vec3.copy(this.position, position)

      // Rotations
      const rotatedForward = vec3.clone(this.defaultForward)
      vec3.transformQuat(rotatedForward, rotatedForward, quaternion)

      // Rotation Y
      const rotatedYForward = vec3.clone(rotatedForward)
      rotatedYForward[1] = 0
      this.rotateY = vec3.angle(this.defaultForward, rotatedYForward)

      if (vec3.dot(rotatedForward, vec3.fromValues(1, 0, 0)) < 0)
        this.rotateY *= - 1

      // Rotation X
      this.rotateX = vec3.angle(rotatedForward, rotatedYForward)

      if (vec3.dot(rotatedForward, vec3.fromValues(0, 1, 0)) > 0)
        this.rotateX *= - 1
    }
  }

  deactivate() {
    this.active = false
  }

  update() {
    if (!this.active)
      return

    // Rotation X and Y
    const controls = this.state.controls
    const viewport = this.state.viewport
    const normalisedPointer = viewport.normalise(controls.pointer.delta)

    this.rotateX -= normalisedPointer.y
    this.rotateY -= normalisedPointer.x

    if (this.rotateX < this.rotateXLimits.min)
      this.rotateX = this.rotateXLimits.min
    if (this.rotateX > this.rotateXLimits.max)
      this.rotateX = this.rotateXLimits.max

    // Rotation Matrix
    const rotationMatrix = mat4.create()
    mat4.rotateY(rotationMatrix, rotationMatrix, this.rotateY)
    mat4.rotateX(rotationMatrix, rotationMatrix, this.rotateX)
    quat2.fromMat4(this.quaternion, rotationMatrix)

    // Update directions
    vec3.copy(this.forward, this.defaultForward)
    vec3.transformMat4(this.forward, this.forward, rotationMatrix)
    vec3.cross(this.rightward, this.gameUp, this.forward)
    vec3.cross(this.upward, this.forward, this.rightward)
    vec3.negate(this.backward, this.forward)
    vec3.negate(this.leftward, this.rightward)
    vec3.negate(this.downward, this.upward)

    // Position
    const direction = vec3.create()
    if (controls.keys.down.forward)
      vec3.add(direction, direction, this.backward)

    if (controls.keys.down.backward)
      vec3.add(direction, direction, this.forward)

    if (controls.keys.down.strafeRight)
      vec3.add(direction, direction, this.rightward)

    if (controls.keys.down.strafeLeft)
      vec3.add(direction, direction, this.leftward)

    if (controls.keys.down.jump)
      vec3.add(direction, direction, this.upward)

    if (controls.keys.down.crouch)
      vec3.add(direction, direction, this.downward)

    const speed = (controls.keys.down.boost ? 20 : 10) * this.state.clock.delta

    vec3.normalize(direction, direction)
    vec3.scale(direction, direction, speed)
    vec3.add(this.position, this.position, direction)
  }
}

export class CameraThirdPerson {
  constructor(state) {
    this.state = state

    this.active = false
    this.gameUp = vec3.fromValues(0, 1, 0)
    this.position = vec3.create()
    this.quaternion = quat2.create()
    this.distance = 10

    // 当前角度
    this.phi = Math.PI * 0.4
    this.theta = 0
    // 目标角度
    this.targetPhi = this.phi;
    this.targetTheta = this.theta;

    this.smoothFactor = 0.2

    this.aboveOffset = 2
    this.phiLimits = { min: 0.1, max: Math.PI - 0.1 }
  }

  activate() {
    this.active = true
  }

  deactivate() {
    this.active = false
  }

  update() {
    if (!this.active)
      return

    // Phi and theta
    const { controls, viewport, player } = this.state
    const normalisedPointer = viewport.normalise(controls.pointer.delta)
    this.targetPhi -= normalisedPointer.y
    this.targetTheta -= normalisedPointer.x

    if (this.distance > 4.01) {
      this.distance += (4 - this.distance) * 0.05
    } else {
      this.distance = 4
    }

    // 缓动：使用线性插值（lerp）或指数平滑
    this.phi += (this.targetPhi - this.phi) * this.smoothFactor
    this.theta += (this.targetTheta - this.theta) * this.smoothFactor

    if (this.phi < this.phiLimits.min)
      this.phi = this.targetPhi = this.phiLimits.min
    if (this.phi > this.phiLimits.max)
      this.phi = this.targetPhi = this.phiLimits.max

    // Position
    const sinPhiRadius = Math.sin(this.phi) * this.distance
    const sphericalPosition = vec3.fromValues(
      sinPhiRadius * Math.sin(this.theta),
      Math.cos(this.phi) * this.distance,
      sinPhiRadius * Math.cos(this.theta)
    )
    vec3.add(this.position, player.position, sphericalPosition)

    // Target
    const target = vec3.fromValues(
      player.position[0],
      player.position[1] + this.aboveOffset,
      player.position[2]
    )

    // Quaternion
    const toTargetMatrix = mat4.create()
    mat4.targetTo(toTargetMatrix, this.position, target, this.gameUp)
    quat2.fromMat4(this.quaternion, toTargetMatrix)

    // Clamp to ground
    const chunks = this.state.chunks
    let elevation = chunks.getElevationForPosition(this.position[0], this.position[2])

    // 相机可参照最低海拔
    const low = 0
    if (elevation < low) elevation = low

    // 相机位置始终高于地形位置 1.25 个高度
    if (this.position[1] < elevation + 1.25)
      this.position[1] = elevation + 1.25
  }
}