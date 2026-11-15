// BlockRooms — where a visitor appears to be (GET /api/where), for the welcome
// on the front page. This file is only where the host looks for it; what it
// does, and what it does not keep, is tools/blockrooms/where-api.mjs.
import { handle } from '../tools/blockrooms/where-api.mjs';

export const GET = (request) => handle(request);
