function [M,F] = HeStif3D_v1_2(nodes,dmat,denss)

%% HeStif3D Evaluates the stiffness matrix and the mass force vector for a
%           hexahedron element
%
%  Parameters:
%
%    Input, nodes : Contains the 3D coordinates of the element nodes
%           dmat  : Constitutive matrix
%           denss : Density 
%   
%    Output, M the element local stiffness matrix
%            F the element local force vector

  fform = @(s,t,v)[(1-s)*(1-t)*(1-v)/8,(1+s)*(1-t)*(1-v)/8,...
                   (1+s)*(1+t)*(1-v)/8,(1-s)*(1+t)*(1-v)/8,...
                   (1-s)*(1-t)*(1+v)/8,(1+s)*(1-t)*(1+v)/8,...
                   (1+s)*(1+t)*(1+v)/8,(1-s)*(1+t)*(1+v)/8];                     
                   
  deriv = @(s,t,v)[-(1-t)*(1-v)/8, (1-t)*(1-v)/8,...
                    (1+t)*(1-v)/8,-(1+t)*(1-v)/8,...
                   -(1-t)*(1+v)/8, (1-t)*(1+v)/8,...
                    (1+t)*(1+v)/8,-(1+t)*(1+v)/8 ; 
                   -(1-s)*(1-v)/8,-(1+s)*(1-v)/8,...
                    (1+s)*(1-v)/8, (1-s)*(1-v)/8,...
                   -(1-s)*(1+v)/8,-(1+s)*(1+v)/8,...
                    (1+s)*(1+v)/8, (1-s)*(1+v)/8 ;   
                   -(1-s)*(1-t)/8,-(1+s)*(1-t)/8,...
                   -(1+s)*(1+t)/8,-(1-s)*(1+t)/8,...
                    (1-s)*(1-t)/8, (1+s)*(1-t)/8,...
                    (1+s)*(1+t)/8, (1-s)*(1+t)/8 ];  

  pospg = [ -0.577350269189626E+00 ,  0.577350269189626E+00 ];
  pespg = [  1.0E+00 ,  1.0E+00 ];
  M = zeros(24,24);
  fy = zeros(1,8);

  for i = 1 : 2
    for j = 1 : 2
      for k = 1 : 2
        lcffm = fform(pospg(i),pospg(j),pospg(k)); % SF at gauss point
        lcder = deriv(pospg(i),pospg(j),pospg(k)); % SF Local derivatives
        xjacm = lcder*nodes;                       % Jacobian matrix
        ctder = xjacm\lcder;                       % SF Cartesian derivates
        dvol = det(xjacm)*pespg(i)*pespg(j)*pespg(k);
        
        bmat = [];
        for inode = 1 : 8
          bmat = [ bmat ,[ctder(1,inode),            0 ,           0  ;
                                      0 ,ctder(2,inode),           0  ;
                                      0 ,            0 ,ctder(3,inode);
                          ctder(2,inode),ctder(1,inode),           0  ;
                          ctder(3,inode),            0 ,ctder(1,inode);
                                      0 ,ctder(3,inode),ctder(2,inode)]];
        end
        
        M = M + (bmat'*dmat*bmat*dvol);
        
        fy = fy + lcffm*denss*dvol;

      end
    end
  end

  F = [ 0, 0,-fy(1), 0, 0,-fy(2), 0, 0,-fy(3), 0, 0,-fy(4), ...
        0, 0,-fy(5), 0, 0,-fy(6), 0, 0,-fy(7), 0, 0,-fy(8)];
          
