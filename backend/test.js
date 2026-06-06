import supabase from './src/config/supabase.js'

async function test() {
  const { data, error } = await supabase
    .from('courier_providers')
    .select('*')

  console.log('DATA:', data)
  console.log('ERROR:', error)
}

test()