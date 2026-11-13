function S = TeStrs3D_v1_2(nodes,dmat,displ)

%% TeStrs3D Evaluates the stresses for a tetrahedron element
%
%  Parameters:
%
%    Input, nodes : Contains the 3D coordinates of the element nodes
%           dmat  : Constitutive matrix
%           displ : Nodal displacements
%   
%    Output, S the element constant stress vector

  deriv = @(s,t,v)[-1, 1, 0, 0;
                   -1, 0, 1, 0;
                   -1, 0, 0, 1];
  
  lcder = deriv(1/4,1/4,1/4) ;                     % SF Local derivatives
  xjacm = lcder*nodes ;                            % Jacobian matrix
  ctder = xjacm\lcder ;                            % SF Cartesian derivates

  bmat = [];
  for inode = 1 : 4
    bmat = [ bmat ,[ctder(1,inode),            0 ,           0  ;
                                0 ,ctder(2,inode),           0  ;
                                0 ,            0 ,ctder(3,inode);
                    ctder(2,inode),ctder(1,inode),           0  ;
                    ctder(3,inode),            0 ,ctder(1,inode);
                                0 ,ctder(3,inode),ctder(2,inode)]];
  end

  S = dmat*bmat*displ;
   
