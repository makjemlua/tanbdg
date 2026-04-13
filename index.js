const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

// ===== CONFIG =====
const TOKEN = "8634672475:AAEJNHCwpDLaRYUa8xHCcqjeMD2WOiU8QcE";
const MONGO = "mongodb+srv://nguyenan2502:Zxcvbnm@tanbdg.teh63h5.mongodb.net/?appName=TanBDG";

const bot = new TelegramBot(TOKEN, { polling: true });

mongoose.connect(MONGO);

// ===== MODEL =====
const DeviceSchema = {
  name: String,
  serial: String,
  image: String,
  note: String
};

const House = mongoose.model("House", {
  house: String,
  devices: [DeviceSchema]
});

// ===== STATE =====
let state = {};

// ===== MENU =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "📋 Menu:", {
    reply_markup: {
      keyboard: [
        ["🏠 Tạo nhà trạm"],
        ["📋 Danh sách nhà trạm", "✏️ Sửa nhà trạm"],
        ["➕ Thêm thiết bị", "✏️ Sửa thiết bị", "🗑️ Xoá thiết bị"],
        ["📂 Xem nhà trạm", "🗑️ Xoá nhà trạm"],
        ["🔄 Chuyển thiết bị"]
      ],
      resize_keyboard: true
    }
  });
});

// ===== MAIN =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  try {

    // ===== TẠO NHÀ =====
  if (msg.text === "🏠 Tạo nhà trạm") {
    state[chatId] = "create_house";
    return bot.sendMessage(chatId, "Nhập SỐ nhà (VD: 123)");
  }

  if (state[chatId] === "create_house") {
    const number = msg.text.trim();

    // kiểm tra chỉ có số
    if (!/^\d+$/.test(number)) {
      return bot.sendMessage(chatId, "❌ Chỉ được nhập số!");
    }

    const house = number;

    const exist = await House.findOne({ house });

    if (exist) {
      state[chatId] = null;
      return bot.sendMessage(chatId, "❌ Nhà đã tồn tại!");
    }

    await House.create({
      house,
      devices: []
    });

    state[chatId] = null;

    bot.sendMessage(chatId, "✅ Đã tạo nhà: " + house);
  }

    // ===== DANH SÁCH NHÀ =====
    if (msg.text === "📋 Danh sách nhà trạm") {
      const houses = await House.find();

      if (houses.length === 0) {
        return bot.sendMessage(chatId, "Chưa có nhà trạm nào!");
      }

      let text = "🏠 Danh sách nhà trạm:\n";

      houses.forEach(h => {
        text += "- " + h.house + "\n";
      });

      return bot.sendMessage(chatId, text);
    }

    // ===== SỬA NHÀ =====
    if (msg.text === "✏️ Sửa nhà trạm") {
      state[chatId] = "edit_house";
      return bot.sendMessage(chatId, "Nhập mã nhà cần sửa (VD: 123)");
    }

    // nhập nhà cũ
    if (state[chatId] === "edit_house") {
      const oldHouse = msg.text.trim();

      const h = await House.findOne({ house: oldHouse });

      if (!h) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Không tìm thấy nhà");
      }

      state[chatId] = {
        mode: "editing_house",
        oldHouse
      };

      return bot.sendMessage(chatId, "Nhập SỐ nhà trạm mới (VD: 456)");
    }

    // nhập nhà mới
    if (state[chatId]?.mode === "editing_house") {
      const number = msg.text.trim();

      if (!/^\d+$/.test(number)) {
        return bot.sendMessage(chatId, "❌ Chỉ được nhập số!");
      }

      const newHouse = number;

      // kiểm tra trùng
      const exist = await House.findOne({ house: newHouse });

      if (exist) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Nhà trạm mới đã tồn tại!");
      }

      // cập nhật
      await House.updateOne(
        { house: state[chatId].oldHouse },
        { house: newHouse }
      );

      state[chatId] = null;

      bot.sendMessage(chatId, "✅ Đã đổi tên nhà trạm thành: " + newHouse);
    }

    // ===== THÊM THIẾT BỊ =====
    if (msg.text === "➕ Thêm thiết bị") {
      state[chatId] = "add";
      return bot.sendMessage(chatId, "Gửi ảnh + info:\nhouse\nname\nserial\nnote");
    }

    if (msg.photo && state[chatId] === "add") {
      const [house, name, serial, note] = msg.caption.split("\n");
      const fileId = msg.photo[msg.photo.length - 1].file_id;

      let h = await House.findOne({ house });

      if (!h) {
        return bot.sendMessage(chatId, "❌ Nhà trạm chưa tồn tại! Hãy tạo trước.");
      }

      h.devices.push({
        name,
        serial,
        image: fileId,
        note
      });

      await h.save();

      state[chatId] = null;

      return bot.sendMessage(chatId, "✅ Đã thêm thiết bị!");
    }

    // ===== SỬA THIẾT BỊ =====
    if (msg.text === "✏️ Sửa thiết bị") {
      state[chatId] = "edit_device";
      return bot.sendMessage(chatId, "Nhập SERIAL cần sửa");
    }

    // nhập serial cũ
    if (state[chatId] === "edit_device") {
      const serial = msg.text.trim();

      const h = await House.findOne({ "devices.serial": serial });

      if (!h) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Không tìm thấy thiết bị");
      }

      state[chatId] = {
        mode: "editing_device",
        serialOld: serial
      };

      return bot.sendMessage(chatId,
        "Gửi ảnh + info mới:\nhouse\nname\nserial\nnote");
    }

    // cập nhật
    if (msg.photo && state[chatId]?.mode === "editing_device") {
      const serialOld = state[chatId].serialOld;

      const [house, name, serialNew, note] = msg.caption.split("\n");
      const fileId = msg.photo[msg.photo.length - 1].file_id;

      const h = await House.findOne({ "devices.serial": serialOld });

      if (!h) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Không tìm thấy");
      }

      // kiểm tra serial mới có bị trùng không
      const exist = await House.findOne({ "devices.serial": serialNew });
      if (exist && serialNew !== serialOld) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Serial mới đã tồn tại!");
      }

      const d = h.devices.find(x => x.serial === serialOld);

      d.name = name;
      d.serial = serialNew;
      d.note = note;
      d.image = fileId;

      await h.save();

      state[chatId] = null;

      bot.sendMessage(chatId, "✅ Đã cập nhật thiết bị!");
    }

    // ===== XEM NHÀ =====
    if (msg.text === "📂 Xem nhà trạm") {
      state[chatId] = "view";
      return bot.sendMessage(chatId, "Nhập mã nhà trạm:");
    }

    if (state[chatId] === "view") {
      const h = await House.findOne({ house: msg.text });

      if (!h) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Không có nhà trạm");
      }

      if (h.devices.length === 0) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "Nhà trạm chưa có thiết bị");
      }

      for (let d of h.devices) {
        await bot.sendPhoto(chatId, d.image, {
          caption:
            `🏠Mã trạm: ${h.house}\n📱Thiết bị: ${d.name}\n🔢 Serial: ${d.serial}\n📝 Ghi chú: ${d.note}`
        });
      }

      state[chatId] = null;
    }

    // ===== XOÁ NHÀ =====
    if (msg.text === "🗑️ Xoá nhà trạm") {
      state[chatId] = "delete_house";
      return bot.sendMessage(chatId, "Nhập mã nhà trạm cần xoá (VD: 0357)");
    }

    if (state[chatId] === "delete_house") {
      const house = msg.text.trim();

      const h = await House.findOne({ house });

      if (!h) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Không tìm thấy nhà trạm");
      }

      // xoá nhà trạm (kèm toàn bộ thiết bị)
      await House.deleteOne({ house });

      state[chatId] = null;

      bot.sendMessage(chatId, "🗑️ Đã xoá nhà trạm: " + house);
    }

    // ===== XOÁ THIẾT BỊ=====
    if (msg.text === "🗑️ Xoá thiết bị") {
      state[chatId] = "delete";
      return bot.sendMessage(chatId, "Nhập serial:");
    }

    if (state[chatId] === "delete") {
      const h = await House.findOne({ "devices.serial": msg.text });

      if (!h) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Không tìm thấy");
      }

      h.devices = h.devices.filter(d => d.serial !== msg.text);

      await h.save();

      state[chatId] = null;

      return bot.sendMessage(chatId, "🗑️ Đã xoá thiết bị!");
    }

    // ===== CHUYỂN THIẾT BỊ =====
    if (msg.text === "🔄 Chuyển thiết bị") {
      state[chatId] = "move_device";
      return bot.sendMessage(chatId, "Nhập SERIAL thiết bị cần chuyển");
    }

    // nhập serial
    if (state[chatId] === "move_device") {
      const serial = msg.text.trim();

      const h = await House.findOne({ "devices.serial": serial });

      if (!h) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Không tìm thấy thiết bị");
      }

      const device = h.devices.find(d => d.serial === serial);

      state[chatId] = {
        mode: "moving_device",
        serial,
        device,
        oldHouse: h.house
      };

      return bot.sendMessage(chatId, "Nhập nhà trạm mới (VD: 0456)");
    }

    // nhập nhà mới
    if (state[chatId]?.mode === "moving_device") {
      const newHouse = msg.text.trim();

      const target = await House.findOne({ house: newHouse });

      if (!target) {
        state[chatId] = null;
        return bot.sendMessage(chatId, "❌ Nhà trạm mới không tồn tại");
      }

      const { serial, device, oldHouse } = state[chatId];

      // tìm nhà cũ
      const old = await House.findOne({ house: oldHouse });

      // xoá khỏi nhà cũ
      old.devices = old.devices.filter(d => d.serial !== serial);
      await old.save();

      // thêm vào nhà mới
      target.devices.push(device);
      await target.save();

      state[chatId] = null;

      bot.sendMessage(chatId, `🔄 Đã chuyển thiết bị sang ${newHouse}`);
    }

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "❌ Lỗi hệ thống!");
  }
});