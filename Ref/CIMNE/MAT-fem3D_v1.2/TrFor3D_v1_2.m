function F = TrFor3D_v1_2(nodes,force,loc_code)

%% TrFor3D Evaluates the global force vector for a triangular face
%
%  Parameters:
%
%    Input, nodes : Contains the 3D coordinates of the element nodes
%           force : Side force vector
%        loc_code : Local(1) or Global(2) force code
%   
%    Output, F the element local force vector

  fform = @(s,t)[ 1-s-t, s, t];                     

  deriv = @(s,t)[-1, 1, 0;
                 -1, 0, 1];
  
  Te = Rotation_system_v1_2(nodes);
  ctxy = nodes*Te';               % Rotate coordinates to element mid plane
  
  if (loc_code == 1)
    force = Te'*force';
  end

  lcffm = fform(1/3,1/3);
  lcder = deriv(1/3,1/3);                            % SF Local derivatives
  xjacm = lcder*ctxy(1:3,1:2) ;                      % Jacobian matrix
  darea = det(xjacm)/2;

  fx = lcffm*darea*force(1);
  fy = lcffm*darea*force(2);
  fz = lcffm*darea*force(3);
  
  F = [fx(1),fy(1),fz(1),fx(2),fy(2),fz(2),fx(3),fy(3),fz(3)];
    
