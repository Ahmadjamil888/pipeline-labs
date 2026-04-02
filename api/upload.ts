import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, userId } = req.body;

    if (!file || !userId) {
      return res.status(400).json({ error: 'Missing file or userId' });
    }

    // Decode base64 file
    const buffer = Buffer.from(file.data, 'base64');
    const fileName = `${userId}/${Date.now()}_${file.name}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('datasets')
      .upload(fileName, buffer, {
        contentType: file.type || 'text/csv',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('datasets')
      .getPublicUrl(fileName);

    // Parse CSV to get row/column count
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const rowCount = Math.max(0, lines.length - 1); // Exclude header
    const columnCount = lines[0] ? lines[0].split(',').length : 0;

    // Create dataset record
    const { data: dataset, error: dbError } = await supabase
      .from('datasets')
      .insert({
        user_id: userId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        original_filename: file.name,
        file_type: file.name.split('.').pop()?.toLowerCase() || 'csv',
        storage_path: fileName,
        public_url: publicUrl,
        row_count: rowCount,
        column_count: columnCount,
        status: 'uploaded',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: dbError.message });
    }

    return res.status(200).json({
      id: dataset.id,
      name: dataset.name,
      rowCount,
      columnCount,
      type: dataset.file_type,
    });
  } catch (error: any) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
