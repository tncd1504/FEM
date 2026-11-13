function S = HeStrs3D_v1_2(nodes,dmat,displ)

%% HeStrs3D Evaluates the stresses for a hexahedron element
%
%  Parameters:
%
%    Input, nodes : Contains the 3D coordinates of the element nodes
%           dmat  : Constitutive matrix
%           displ : Nodal displacements
%   
%    Output, S the element constant stress vector

  fform = @(s,t,v)[ (1-s)*(1-t)*(1-v)/8, (1+s)*(1-t)*(1-v)/8,...
                    (1+s)*(1+t)*(1-v)/8, (1-s)*(1+t)*(1-v)/8,...
                    (1-s)*(1-t)*(1+v)/8, (1+s)*(1-t)*(1+v)/8,...
                    (1+s)*(1+t)*(1+v)/8, (1-s)*(1+t)*(1+v)/8];

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

  strsg = [];
  extrap = [];
  order = [ 1, 5, 4, 8, 2, 6, 3, 7];    % Align the G-pts. with the element
                                        % corners
  l = 0;
  for i = 1 : 2
    for j = 1 : 2
      for k = 1 : 2
        lcder = deriv(pospg(i),pospg(j),pospg(k)); % SF Local derivatives
        xjacm = lcder*nodes;                       % Jacobian matrix
        ctder = xjacm\lcder;                       % SF Cartesian derivates
        
        bmat = [];
        for inode = 1 : 8
          bmat = [ bmat ,[ctder(1,inode),            0 ,           0  ;
                                      0 ,ctder(2,inode),           0  ;
                                      0 ,            0 ,ctder(3,inode);
                          ctder(2,inode),ctder(1,inode),           0  ;
                          ctder(3,inode),            0 ,ctder(1,inode);
                                      0 ,ctder(3,inode),ctder(2,inode)]];
        end
        l = l + 1;
        strsg(order(l),:) = (dmat*bmat*displ);
        
        a = 1/pospg(i);
        b = 1/pospg(j);
        c = 1/pospg(k);

        extrap(order(l),:) = fform(a,b,c) ;

      end
    end
  end
  
  S = (extrap*strsg);
             
