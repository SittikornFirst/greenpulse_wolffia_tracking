import SystemLog from '../models/SystemLog.js';

/**
 * Creates a standard audit log entry.
 * 
 * @param {Object} data 
 * @param {String} [data.user_id] 
 * @param {String} [data.device_id]
 * @param {String} data.target_type - 'User', 'Device', 'Farm', 'Alert', 'System'
 * @param {String} data.target_id 
 * @param {String} data.action_type - 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'REGISTER'
 * @param {String} data.event 
 * @param {String} data.message 
 * @param {String} [data.log_type='INFO'] 
 */
export const auditLog = async (data) => {
    try {
        await SystemLog.create({
            user_id: data.user_id || undefined,
            device_id: data.device_id || undefined,
            target_type: data.target_type,
            target_id: data.target_id,
            action_type: data.action_type,
            event: data.event,
            message: data.message,
            log_type: data.log_type || 'INFO'
        });
    } catch (err) {
        console.error('Failed to write audit log:', err.message);
    }
};
