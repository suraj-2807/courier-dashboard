import supabase from '../../config/supabase.js'

export const createSender =
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
          .from('senders')
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
        sender: data[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const getSenders =
  async (req, res) => {
    try {
      const { data, error } =
        await supabase
          .from('senders')
          .select('*')

      if (error) throw error

      return res.json({
        success: true,
        senders: data
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const getSenderById =
  async (req, res) => {
    try {
      const { id } = req.params

      const { data, error } =
        await supabase
          .from('senders')
          .select('*')
          .eq('id', id)
          .single()

      if (error) throw error

      return res.json({
        success: true,
        sender: data
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const updateSender =
  async (req, res) => {
    try {
      const { id } = req.params

      const { data, error } =
        await supabase
          .from('senders')
          .update(req.body)
          .eq('id', id)
          .select()

      if (error) throw error

      return res.json({
        success: true,
        sender: data[0]
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

export const deleteSender =
  async (req, res) => {
    try {
      const { id } = req.params

      const { error } =
        await supabase
          .from('senders')
          .delete()
          .eq('id', id)

      if (error) throw error

      return res.json({
        success: true,
        message:
          'Sender deleted successfully'
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }