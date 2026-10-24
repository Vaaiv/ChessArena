// replayStore.js — replay files on AWS S3 (turned off when S3_BUCKET is not set)
import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.S3_BUCKET;

// on EC2, credentials come from the instance's IAM role — no keys in .env
const s3 = BUCKET ? new S3Client({ region: process.env.AWS_REGION }) : null;

const key = (id) => `replays/${id}.json`;

export const s3Enabled = () => s3 !== null;

export const uploadReplay = (replay) =>
  s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key(replay.id),
    Body: JSON.stringify(replay),
    ContentType: 'application/json',
  }));

// the replay, or null if there is no file for this game
export const downloadReplay = async (id) => {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key(id) }));
    return JSON.parse(await res.Body.transformToString());
  } catch (err) {
    if (err.name === 'NoSuchKey') return null;
    throw err;
  }
};
