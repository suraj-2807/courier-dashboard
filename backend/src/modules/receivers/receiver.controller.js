import supabase from '../../config/supabase.js'

export const createReceiver =
  async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        address,
        city,
        state,
        pincode
      } = req.body

      const { data, error } =
        await supabase
          .from('receivers')
          .insert([
            {
              name,
              phone,
              email,
              address,
              city,
              state,
              pincode
            }
          ])
          .select()

      if (error) throw error

      return res.status(201).json({
        success: true,
        receiver: data[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const getReceivers =
  async (req, res) => {
    try {
      const { data, error } =
        await supabase
          .from('receivers')
          .select('*')

      if (error) throw error

      return res.json({
        success: true,
        receivers: data
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const getReceiverById =
  async (req, res) => {
    try {
      const { id } = req.params

      const { data, error } =
        await supabase
          .from('receivers')
          .select('*')
          .eq('id', id)
          .single()

      if (error) throw error

      return res.json({
        success: true,
        receiver: data
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const updateReceiver =
  async (req, res) => {
    try {
      const { id } = req.params

      const { data, error } =
        await supabase
          .from('receivers')
          .update(req.body)
          .eq('id', id)
          .select()

      if (error) throw error

      return res.json({
        success: true,
        receiver: data[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const deleteReceiver =
  async (req, res) => {
    try {
      const { id } = req.params

      const { error } =
        await supabase
          .from('receivers')
          .delete()
          .eq('id', id)

      if (error) throw error

      return res.json({
        success: true,
        message:
          'Receiver deleted successfully'
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }