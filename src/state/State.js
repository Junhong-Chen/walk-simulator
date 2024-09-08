import Day from "./Day"
import Sun from "./Sun"
import Player from "./Player"
import Terrains from "./Terrains"
import Controls from "./Controls"
import Chunks from "./Chunks"
import Water from "./Water"


export default class State {
  constructor(app) {
    this.app = app
    this.debug = app.debug
    this.clock = app.clock
    this.viewport = app.viewport

    this.controls = new Controls()
    this.day = new Day(this)
    this.sun = new Sun(this)
    this.player = new Player(this)
    this.chunks = new Chunks(this)
    this.terrains = new Terrains(this)
    this.water = new Water(this)
  }

  update() {
    this.controls.update()
    this.day.update()
    this.sun.update()
    this.player.update()
    this.chunks.update()
    this.water.update()
  }

  destroy() {}
}