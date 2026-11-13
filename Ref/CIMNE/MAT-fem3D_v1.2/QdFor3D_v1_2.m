function F = QdFor3D_v1_2(nodes,force,loc_code)

%% QdFor3D Evaluates the global force vector for a quadrilateral face
%
%  Parameters:
%
%    Input, nodes : Contains the 3D coordinates of the element nodes
%           force : Side force vector
%        loc_code : Local(1) or Global(2) force code
%   
%    Output, F the element local force vector
                     
  fform = @(s,t)[(1-s-t+s*t)/4,(1+s-t-s*t)/4,(1+s+t+s*t)/4,(1-s+t-s*t)/4];
  deriv = @(s,t)[(-1+t)/4,( 1-t)/4,( 1+t)/4,(-1-t)/4;
                 (-1+s)/4,(-1-s)/4,( 1+s)/4,( 1-s)/4];

  pospg = [ -0.577350269189626E+00 ,  0.577350269189626E+00 ];
  pespg = [  1.0E+00 ,  1.0E+00 ];
  fy = zeros(1,8);
    
  Te = Rotation_system_v1_2(nodes);
  ctxy = nodes*Te';               % Rotate coordinates to element mid plane
    
  if (loc_code == 1)
    force  = Te'*force';
  end

  fx = zeros(1,4);
  fy = zeros(1,4);
  fz = zeros(1,4);

  for i = 1 : 2
    for j = 1 : 2
      lcffm = fform(pospg(i),pospg(j));              % SF at gauss point
      lcder = deriv(pospg(i),pospg(j));              % SF Local derivatives
      xjacm = lcder*ctxy(1:4,1:2);                   % Jacobian matrix
      darea = det(xjacm)*pespg(i)*pespg(j);
      
      fx = fx + lcffm*darea*force(1);
      fy = fy + lcffm*darea*force(2);
      fz = fz + lcffm*darea*force(3);
    end
  end

  F = [fx(1),fy(1),fz(1),fx(2),fy(2),fz(2),...
       fx(3),fy(3),fz(3),fx(4),fy(4),fz(4)];
    
