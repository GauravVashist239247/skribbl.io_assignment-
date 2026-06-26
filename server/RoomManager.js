const { customAlphabet } = require("nanoid");
const { Room } = require("./Room");

const generateRoomId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

// RoomManager.js - tracks all active rooms in memory
class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomId -> Room
  }

  createRoom(hostName, settings) {
    let id = generateRoomId();
    while (this.rooms.has(id)) id = generateRoomId();
    const room = new Room(id, this.io, hostName, settings);
    this.rooms.set(id, room);
    return room;
  }

  getRoom(id) {
    return this.rooms.get((id || "").toUpperCase());
  }

  deleteRoom(id) {
    this.rooms.delete(id);
  }

  getPublicRooms() {
    return [...this.rooms.values()]
      .filter((r) => !r.settings.isPrivate && r.game.phase === "lobby" && !r.isFull())
      .map((r) => ({
        roomId: r.id,
        playerCount: r.players.size,
        maxPlayers: r.settings.maxPlayers,
        rounds: r.settings.rounds
      }));
  }

  cleanupEmptyRooms() {
    for (const [id, room] of this.rooms) {
      if (room.isEmpty()) this.rooms.delete(id);
    }
  }
}

module.exports = RoomManager;
