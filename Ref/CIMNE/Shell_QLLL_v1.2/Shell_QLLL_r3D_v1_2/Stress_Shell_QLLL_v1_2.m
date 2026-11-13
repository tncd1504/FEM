function Strnod = Stress_Shell_QLLL_v1_2(D_matb,D_matm,D_mats,gauss_x,gauss_y,u)

%% Stress Evaluates the stresses at the Gauss points and smooth the values
%         to the nodes
%
%  Parameters:
%
%    Input, D_matb  : Constitutive matrix for bending moment
%           D_matm  : Constitutive matrix for membrane forces
%           D_mats  : Constitutive matrix for shear force
%           gauss_x : Local X coordinates of the Gauss points
%           gauss_y : Local Y coordinates of the Gauss points
%           u       : Nodal displacements
%   
%    Output, Strnod the nodal stress matrix (nnode,nstrs)

  global coordinates;
  global elements;
 
% Find basic dimensions
  nelem  = size(elements,1);          % Number of elements
  nnode  = size(elements,2);          % Number of nodes por element
  npnod  = size(coordinates,1);       % Number of nodes
  Strnod = zeros(npnod,9);            % Create array for stresses
  dofpn  = 6;                         % Number of DOF per node
  dofpe  = dofpn*nnode;               % Number of DOF per element
  eqnum  = zeros(dofpe);              % Equation number list

% Shape function matrix for stress extrapolation
  aa = 1 + sqrt(3);
  bb = 1 - sqrt(3);
  mstres = [ aa*aa , aa*bb , bb*bb , aa*bb ;
             bb*aa , aa*aa , aa*bb , bb*bb ;
             bb*bb , aa*bb , aa*aa , bb*aa ;
             aa*bb , bb*bb , bb*aa , aa*aa ]/4;

% Element cycle
  for ielem = 1 : nelem
          
    lnods(1:nnode) = elements(ielem,1:nnode);
  
    cxyz(1:4,1:3) = coordinates(lnods(1:nnode),1:3);  % Element coordinates
    Te = Rotation_system_v1_2(cxyz(1:3,1:3));

    ctxy = cxyz*transpose(Te);    % Rotate coordinates to element mid plane

    coor_x = ctxy(1:nnode,1);                         % Elem. X coordinates
    coor_y = ctxy(1:nnode,2);                         % Elem. Y coordinates
    
% Find the equation number list for the i-th element
    for i = 1 : nnode
      ii = (i-1)*dofpn;
      for j = 1 : dofpn
        eqnum(ii+j) = (lnods(i)-1)*dofpn + j;   % Build the eq. number list
      end
    end
    
% Recover the nodal displacements for the i-th element
    u_elem(1:dofpe) = u(eqnum(1:dofpe));

    for igaus = 1 : 4
      x = gauss_x(igaus);
      y = gauss_y(igaus);
      
      [bmat_b,bmat_m,bmat_s,area] = B_mat_Shell_QLLL_r3D_v1_2(x,y,coor_x,coor_y,Te); 

      Str1 = D_matb*bmat_b*transpose(u_elem);
      Str2 = D_matm*bmat_m*transpose(u_elem);
      Str3 = D_mats*bmat_s*transpose(u_elem);
      
      StrMx(igaus)  = Str1(1);
      StrMy(igaus)  = Str1(2);
      StrMxy(igaus) = Str1(3);
      StrNx(igaus)  = Str2(1);
      StrNy(igaus)  = Str2(2);
      StrNxy(igaus) = Str2(3);
      StrQx(igaus)  = Str3(1);
      StrQy(igaus)  = Str3(2);
       
    end

    Str1 = mstres * transpose(StrMx);
    Strnod(lnods(1:4),1) = Strnod(lnods(1:4),1) + Str1(1:4);
    Str1 = mstres * transpose(StrMy);
    Strnod(lnods(1:4),2) = Strnod(lnods(1:4),2) + Str1(1:4);
    Str1 = mstres * transpose(StrMxy);
    Strnod(lnods(1:4),3) = Strnod(lnods(1:4),3) + Str1(1:4);
    Str2 = mstres * transpose(StrNx);
    Strnod(lnods(1:4),4) = Strnod(lnods(1:4),4) + Str2(1:4);
    Str2 = mstres * transpose(StrNy);
    Strnod(lnods(1:4),5) = Strnod(lnods(1:4),5) + Str2(1:4);
    Str2 = mstres * transpose(StrNxy);
    Strnod(lnods(1:4),6) = Strnod(lnods(1:4),6) + Str2(1:4);
    Str3 = mstres * transpose(StrQx);
    Strnod(lnods(1:4),7) = Strnod(lnods(1:4),7) + Str3(1:4);
    Str3 = mstres * transpose(StrQy);
    Strnod(lnods(1:4),8) = Strnod(lnods(1:4),8) + Str3(1:4);
    Strnod(lnods(1:4),9) = Strnod(lnods(1:4),9) + 1;

  end
  
  for i = 1 : npnod
    Strnod(i,1:8) = Strnod(i,1:8)/Strnod(i,9);
  end   
    
