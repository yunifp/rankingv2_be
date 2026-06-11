import mongoose from 'mongoose';

export const connectMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('✅ MongoDB Terhubung untuk Log Transaksi');
    } catch (error) {
        console.error('❌ Gagal terhubung ke MongoDB:', error);
    }
};

const logTransaksiSchema = new mongoose.Schema({
    id_trx: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    payload: { type: mongoose.Schema.Types.Mixed, required: true }
}, { versionKey: false });

export const LogTransaksi = mongoose.model('LogTransaksi', logTransaksiSchema, 'log_transaksi');