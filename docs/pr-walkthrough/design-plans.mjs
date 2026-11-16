import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export const plans=["story-our-pr","story-checkout","story-relocation","story-dependency","story-tokio","story-vue","story-django","story-vllm","story-kubernetes"].map(id=>JSON.parse(fs.readFileSync(path.join(root,'story-plans',id+'.json'),'utf8')));
