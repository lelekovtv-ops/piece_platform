import { teamService } from '../modules/teams/service.js';

export function requireTeamSelection() {
  return (req, res, next) => {
    const teamId = req.headers['x-selected-team'];

    if (!teamId) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'x-selected-team header is required',
      });
    }

    req.teamId = teamId;
    next();
  };
}

export function requireTeamAccess() {
  return async (req, res, next) => {
    const { teamId } = req;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Team and user context required',
      });
    }

    const role = await teamService.getMemberRole(teamId, userId);
    if (!role) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this team',
      });
    }

    req.teamRole = role;
    next();
  };
}
