/**
 * @type {CanvasRenderingContext2D}
 */

import { Drawer } from "./lib/Drawer.js";
let drawer = null;
let canvas, g;

const socket = io(); //socketIOを導入
let connected = false;

let player = null;

//ページロード完了時に実行
window.onload = function () {
  // canvasの2d要素を取得 g に代入
  canvas = document.getElementById("gamecanvas");
  g = canvas.getContext("2d");
  g.font = "30px Roboto medium";
  drawer = new Drawer(g);
  player = new Player();
  canvas.addEventListener("mousemove", (e) => { player.getMouse(e) }, false);
  canvas.addEventListener("mousedown", (e) => { player.mouseDown(e) }, false);
  canvas.addEventListener("mouseup", (e) => { player.mouseUp(e) }, false);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault(), false);
};

//クライアントのプレイヤークラス　イベントリスナーに応じてsocketを送信
class Player {
  constructor() {
    this.mouseX = 240;
    this.mouseY = 700;
    this.leftClickStatus = "NO";
    this.rightClickStatus = "NO";
    this.userId = null;
  }
  getMouse(e) {
    var rect = e.target.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top + 1;
    this.emitThis();
  }
  mouseDown(e) {
    if (e.button == 0) {
      this.leftClickStatus = "YES";
    }
    if (e.button == 2) {
      e.preventDefault()
      this.rightClickStatus = "YES";
    }
    this.emitThis();
  }
  mouseUp(e) {
    this.leftClickStatus = "NO";
    this.rightClickStatus = "NO";
    this.emitThis();
  }
  emitThis() {
    connected ? socket.emit("clientData", this) : console.log("no connection");
  }
}

//接続初期処理
socket.on("connection", (userId) => {
  drawer.background();
  player.userId = userId;
  connected = true;
});

//sessionのルームIDがサーバー側にもう存在しない場合、ホームへリダイレクトする
socket.on("noRoom", () => {
  window.alert("この部屋はもうありません。ホームに戻ります")
  window.location.href = ("/");
});
//サーバーデータ受信後の動作
socket.on("serverData", (state) => {
  const players = state.players;
  const game = state.game;

  drawer.background(); //背景描写
  drawer.roomName(state.roomName); //ルーム名描写
  drawer.teamBoard(state.team,state.nowTurn,players); //チームボード描写
  if (game === undefined) { //ゲームオブジェクト作成前
    console.log("ロビー描画")
    drawLobby(state);
  } else { //ゲームオブジェクト作成後
    drawGame(game);
  }
  //ユーザーカーソルの描画
  Object.values(players).forEach((value) => {
    drawer.user(value,state.nowTurn);
  });

});

const Scenes = {
  Pose: "Pose",
  BeforeShot: "BeforeShot",
  Moving: "Moving",
  Checking: "Cheking",
  End: "End"
}
function drawLobby(state) {
  drawer.paramBoard(state.endTimes,state.stoneNumber);
  drawer.startButton();
}

function drawGame(game) {
  //得点板の描画
  drawer.scoreBoard(game.endTimes, game.sumA, game.sumB, game.scores);
  //メッセージ板の描画
  drawer.message(game.message1, game.message2);

  for (let i in game.stones) {
    drawer.stone(game.stones[i]);
  }
  if (game.scene == Scenes.BeforeShot) {
    let stone;
    if (game.turn == "A") {
      stone = game.stoneA;
    }
    else if (game.turn == "B") {
      stone = game.stoneB;
    }
    drawer.stone(stone);
    drawer.power(game.power, stone.p);
  }
  g.save();
}