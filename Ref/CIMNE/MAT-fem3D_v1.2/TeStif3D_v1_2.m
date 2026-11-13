function [M,F] = TeStif3D_v1_2(nodes,dmat,denss)

%% TeStif3D Evaluates the stiffness matrix and the mass force vector for a
%           tetrahedron element
%
%  Parameters:
%
%    Input, nodes : Contains the 3D coordinates of the element nodes
%            dmat : Constitutive matrix
%           denss : Density
%   
%    Output, M the element local stiffness matrix
%            F the element local force vector

  fform = @(s,t,v)[ 1-s-t-v, s, t, v];
                
  deriv = @(s,t,v)[-1, 1, 0, 0;
                   -1, 0, 1, 0;
                   -1, 0, 0, 1];

  lcffm = fform(1/4,1/4,1/4);
  lcder = deriv(1/4,1/4,1/4);                      % SF Local derivatives
  xjacm = lcder*nodes;                             % Jacobian matrix
  ctder = xjacm\lcder;                             % SF Cartesian derivates
  dvol = det(xjacm)/6;

  bmat = [];
  for inode = 1 : 4
    bmat = [ bmat ,[ctder(1,inode),            0 ,           0  ;
                                0 ,ctder(2,inode),           0  ;
                                0 ,            0 ,ctder(3,inode);
                    ctder(2,inode),ctder(1,inode),           0  ;
                    ctder(3,inode),            0 ,ctder(1,inode);
                                0 ,ctder(3,inode),ctder(2,inode)]];
  end
  
  M = bmat'*dmat*bmat*dvol;

  fy = -lcffm*denss*dvol;

  F = [ 0, 0, fy(1), 0, 0, fy(2), 0, 0, fy(3), 0, 0, fy(4)];
 
