const axios = require('axios');

// Simulated vendor API configuration
const VENDOR_API_URL = process.env.VENDOR_API_URL || 'http://localhost:3001/api/vendor';
const SUCCESS_RATE = 0.9; // 90% success rate as per requirements

class VendorService {
  // Simulate sending a message to a customer
  async sendMessage(customer, message) {
    try {
      // Simulate API call to vendor
      const response = await axios.post(VENDOR_API_URL, {
        customerId: customer.customerId,
        email: customer.email,
        message: message
      });

      // Simulate random success/failure (90% success rate)
      const isSuccess = Math.random() < SUCCESS_RATE;
      
      return {
        success: isSuccess,
        messageId: response.data.messageId,
        status: isSuccess ? 'SENT' : 'FAILED',
        error: isSuccess ? null : 'Simulated delivery failure'
      };
    } catch (error) {
      return {
        success: false,
        messageId: null,
        status: 'FAILED',
        error: error.message
      };
    }
  }

  // Process delivery receipt
  async processDeliveryReceipt(receipt) {
    try {
      // Validate receipt
      if (!receipt.messageId || !receipt.status) {
        throw new Error('Invalid receipt format');
      }

      // Process receipt (in real implementation, this would update the database)
      return {
        success: true,
        message: 'Receipt processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Batch process messages
  async batchProcessMessages(customers, message) {
    const results = [];
    const batchSize = 50; // Process 50 messages at a time

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(customer => this.sendMessage(customer, message))
      );
      results.push(...batchResults);
    }

    return results;
  }
}

module.exports = new VendorService(); 